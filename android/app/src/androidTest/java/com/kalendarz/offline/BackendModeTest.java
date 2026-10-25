package com.kalendarz.offline;

import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real WebView/Capacitor mode acknowledgements and persistence. Run only on a
 * disposable test profile. Does not load a model or claim physical GPU inference. */
@RunWith(AndroidJUnit4.class)
public class BackendModeTest extends CalendarSmokeTest {
    private void settings(ActivityScenario<MainActivity> scenario)throws Exception {
        until(scenario,"document.querySelector('#btn-open-ai-assistant')");
        evaluate(scenario,"document.querySelector('#btn-open-ai-assistant').click()");
        until(scenario,"document.querySelector('#btn-ai-settings')");
        evaluate(scenario,"document.querySelector('#btn-ai-settings').click()");
        until(scenario,"document.querySelector('[data-mode=cpu]')");
    }
    @Test public void cpuModeSurvivesReloadAndNativeBridgeAcknowledgesIt()throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            settings(scenario);
            until(scenario,"!document.querySelector('[data-mode=cpu]').disabled");
            evaluate(scenario,"document.querySelector('[data-mode=cpu]').click()");
            until(scenario,"document.querySelector('[data-testid=backend-mode-result]')?.getAttribute('role')==='status'");
            assertEquals("\"cpu\"",evaluate(scenario,"localStorage.getItem('calendar_ai_backend_mode_v1')"));
            evaluate(scenario,"window.Capacitor.nativePromise('CalendarNativeAI','status',{}).then(s=>window.__modeDevice=s)");
            until(scenario,"window.__modeDevice?.mode==='cpu'");
            assertEquals("false",evaluate(scenario,"window.__modeDevice.loaded||window.__modeDevice.gpuActive"));
            evaluate(scenario,"location.reload()");settings(scenario);
            assertEquals("\"true\"",evaluate(scenario,"document.querySelector('[data-mode=cpu]').getAttribute('aria-pressed')"));
        }
    }
}
