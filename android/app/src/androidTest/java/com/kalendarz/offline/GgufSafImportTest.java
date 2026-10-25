package com.kalendarz.offline;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.*;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real native picker callback, content URI, WebView stream, OPFS and restart.
 * Picker selection is injected. Synthetic metadata is storage evidence only;
 * the fixture contains no inference weights. Run on a disposable test device. */
@RunWith(AndroidJUnit4.class)
public class GgufSafImportTest extends CalendarSmokeTest {
    private void u32(ByteArrayOutputStream out,int n)throws Exception{out.write(ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(n).array());}
    private void u64(ByteArrayOutputStream out,long n)throws Exception{out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(n).array());}
    private void text(ByteArrayOutputStream out,String text)throws Exception{byte[] bytes=text.getBytes(StandardCharsets.UTF_8);u64(out,bytes.length);out.write(bytes);}
    @Test public void importNonCatalogueGgufThroughSafAndRetainAfterRestart()throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();out.write("GGUF".getBytes(StandardCharsets.US_ASCII));u32(out,3);u64(out,1);u64(out,3);
        text(out,"general.architecture");u32(out,8);text(out,"llama");text(out,"llama.context_length");u32(out,4);u32(out,2048);text(out,"general.file_type");u32(out,4);u32(out,15);out.write(new byte[4096]);byte[] bytes=out.toByteArray();
        android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();File source=new File(context.getCacheDir(),"saf-local-uncatalogued.gguf");Files.write(source.toPath(),bytes);
        StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));String id="imported-"+hash;
        init();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",source))));
            until(scenario,"document.querySelector('#btn-open-ai-assistant')");evaluate(scenario,"document.querySelector('#btn-open-ai-assistant').click()");until(scenario,"document.querySelector('#btn-ai-settings')");evaluate(scenario,"document.querySelector('#btn-ai-settings').click()");
            until(scenario,"document.querySelector('#ai-import-gguf')&&!document.querySelector('#ai-import-gguf').disabled");evaluate(scenario,"document.querySelector('#ai-import-gguf').click()");
            until(scenario,"localStorage.getItem('calendar_active_ai_model_v1')==='"+id+"'&&document.querySelector('[data-testid=local-model-setup]')?.dataset.modelInstalled==='true'",60);intended(hasAction(Intent.ACTION_OPEN_DOCUMENT));
            assertArrayEquals(bytes,Files.readAllBytes(source.toPath()));
            scenario.recreate();until(scenario,"document.querySelector('#btn-open-ai-assistant')");
            assertEquals("\""+id+"\"",evaluate(scenario,"localStorage.getItem('calendar_active_ai_model_v1')"));
            assertEquals("true",evaluate(scenario,"JSON.parse(localStorage.getItem('calendar_imported_ai_models_v1')).some(m=>m.id==='"+id+"'&&m.bytes==="+bytes.length+")"));
            evaluate(scenario,"window.__opfsStored=false;const r=indexedDB.open('calendar-local-model');r.onsuccess=()=>{const db=r.result,g=db.transaction('models').objectStore('models').get('"+id+"');g.onsuccess=async()=>{const entry=g.result;db.close();if(!entry?.opfsName)return;const d=await(await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');const f=await(await d.getFileHandle(entry.opfsName)).getFile();window.__opfsStored=f.size==="+bytes.length+";};};");until(scenario,"window.__opfsStored");
        }finally{release();source.delete();}
    }
}
