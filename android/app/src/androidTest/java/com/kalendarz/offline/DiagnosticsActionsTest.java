package com.kalendarz.offline;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.*;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real WebView -> Capacitor -> SAF callback -> document write/UI.
 * Run on a disposable Android test device. Picker responses are injected;
 * native bridge and document I/O are real, with no model/GPU inference claim. */
@RunWith(AndroidJUnit4.class)
public class DiagnosticsActionsTest extends CalendarSmokeTest {
    private void openDiagnostics(ActivityScenario<MainActivity> scenario)throws Exception {
        until(scenario,"document.querySelector('#btn-open-ai-assistant')");
        evaluate(scenario,"document.querySelector('#btn-open-ai-assistant').click()");
        until(scenario,"document.querySelector('#btn-ai-settings')");
        evaluate(scenario,"document.querySelector('#btn-ai-settings').click()");
        until(scenario,"document.querySelector('#ai-tab-diagnostics')");
        evaluate(scenario,"document.querySelector('#ai-tab-diagnostics').click()");
        until(scenario,"document.querySelector('#btn-ai-export-diagnostics')");
    }
    private void waitOutcome(ActivityScenario<MainActivity> scenario,boolean error)throws Exception {
        until(scenario,"document.querySelector('[data-testid=diagnostic-action-result]')?.getAttribute('aria-busy')==='false'");
        assertEquals("\""+(error?"alert":"status")+"\"",evaluate(scenario,"document.querySelector('[data-testid=diagnostic-action-result]').getAttribute('role')"));
    }
    @Test public void exportPickerSavesJsonThroughNativeBridge()throws Exception {
        android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File destination=new File(context.getCacheDir(),"diagnostics-export-device-test.json");
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",destination);
        init();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri)));
            openDiagnostics(scenario);evaluate(scenario,"document.querySelector('#btn-ai-export-diagnostics').click()");
            waitOutcome(scenario,false);intended(hasAction(Intent.ACTION_CREATE_DOCUMENT));
            JSONObject report=new JSONObject(new String(Files.readAllBytes(destination.toPath()),StandardCharsets.UTF_8));
            assertEquals(4,report.getInt("version"));assertTrue(report.getJSONArray("actions").length()>0);
        }finally{release();destination.delete();}
    }
    @Test public void exportCancelIsVisible()throws Exception {
        init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
            openDiagnostics(scenario);evaluate(scenario,"document.querySelector('#btn-ai-export-diagnostics').click()");waitOutcome(scenario,false);
            until(scenario,"document.querySelector('#ai-diagnostics-report').textContent.includes('\\\"stage\\\": \\\"cancelled\\\"')");
        }finally{release();}
    }
    @Test public void unwritableExportShowsNativeError()throws Exception {
        init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(Uri.parse("content://com.kalendarz.missing/diagnostics.json"))));
            openDiagnostics(scenario);evaluate(scenario,"document.querySelector('#btn-ai-export-diagnostics').click()");waitOutcome(scenario,true);
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-testid=diagnostic-action-result]').textContent.includes('diagnostics-export-write')"));
        }finally{release();}
    }
    @Test public void releaseClickShowsBackendOutcome()throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            openDiagnostics(scenario);until(scenario,"!document.querySelector('#btn-ai-release-memory').disabled");
            evaluate(scenario,"document.querySelector('#btn-ai-release-memory').click()");waitOutcome(scenario,false);
            until(scenario,"document.querySelector('#ai-diagnostics-report').textContent.includes('release-memory')");
        }
    }
}
