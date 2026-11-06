package com.kalendarz.offline;

import static org.junit.Assert.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.*;

/** Real dataSync service and localhost HTTP. Run on a disposable API 29+ device.
 * This is deliberately independent of a live JavaScript timer or mounted model view.
 */
@RunWith(AndroidJUnit4.class)
public class ModelTransferServiceTest {
    private JSONObject await(Context context,ModelTransferCore.Model model,String phase,int seconds)throws Exception{
        long deadline=System.nanoTime()+seconds*1_000_000_000L;JSONObject state;
        do{state=CalendarModelTransferService.status(context,model);if(phase.equals(state.optString("phase")))return state;Thread.sleep(50);}while(System.nanoTime()<deadline);
        throw new AssertionError("Native transfer did not reach "+phase+": "+state);
    }
    private void start(ActivityScenario<MainActivity> scenario,ModelTransferCore.Model model)throws Exception{
        AtomicReference<Exception> failure=new AtomicReference<>();scenario.onActivity(activity->{try{CalendarModelTransferService.start(activity,model,"en");}catch(Exception error){failure.set(error);}});if(failure.get()!=null)throw failure.get();
    }
    @Test public void transferSurvivesStoppedActivityAndResumesAfterNotificationPause()throws Exception{
        org.junit.Assume.assumeTrue(android.os.Build.VERSION.SDK_INT>=29);
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        ServiceInfo info=context.getPackageManager().getServiceInfo(new ComponentName(context,CalendarModelTransferService.class),0);
        assertFalse(info.exported);assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,info.getForegroundServiceType());
        byte[] bytes=new byte[12*1024*1024];new Random(123).nextBytes(bytes);bytes[0]='G';bytes[1]='G';bytes[2]='U';bytes[3]='F';
        String id="transfer-instrumentation-"+System.nanoTime();AtomicBoolean stop=new AtomicBoolean();List<String> requests=Collections.synchronizedList(new ArrayList<>());
        try(ServerSocket server=new ServerSocket(0,4,InetAddress.getByName("127.0.0.1"))){
            Thread responder=new Thread(()->{while(!stop.get()){try(Socket socket=server.accept()){
                BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String line;int offset=0;
                while((line=input.readLine())!=null&&!line.isEmpty()){requests.add(line);if(line.startsWith("Range: bytes="))offset=Integer.parseInt(line.substring(13,line.length()-1));}
                OutputStream out=socket.getOutputStream();String headers="HTTP/1.1 "+(offset>0?"206 Partial Content":"200 OK")+"\r\nETag: \"device-fixture-v1\"\r\nContent-Length: "+(bytes.length-offset)+"\r\nConnection: close\r\n"+(offset>0?"Content-Range: bytes "+offset+"-"+(bytes.length-1)+"/"+bytes.length+"\r\n":"")+"\r\n";out.write(headers.getBytes(StandardCharsets.US_ASCII));
                for(int position=offset;position<bytes.length;position+=65536){out.write(bytes,position,Math.min(65536,bytes.length-position));out.flush();Thread.sleep(20);}
            }catch(Exception interrupted){if(stop.get())return;}}});responder.setDaemon(true);responder.start();
            ModelTransferCore.Model model=new ModelTransferCore.Model(new JSONObject().put("id",id).put("name","Service test fixture").put("url","http://127.0.0.1:"+server.getLocalPort()+"/model.gguf").put("bytes",bytes.length).put("sha256",ModelTransferCore.hex(MessageDigest.getInstance("SHA-256").digest(bytes))));
            ModelTransferCore storage=new ModelTransferCore(context.getFilesDir(),model,state->{});
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                start(scenario,model);await(context,model,"downloading",10);scenario.moveToState(Lifecycle.State.CREATED);
                long before=CalendarModelTransferService.status(context,model).optLong("receivedBytes"),deadline=System.nanoTime()+10_000_000_000L;
                while(CalendarModelTransferService.status(context,model).optLong("receivedBytes")<=before&&System.nanoTime()<deadline)Thread.sleep(50);
                assertTrue("Stopped Activity must not cancel native I/O",CalendarModelTransferService.status(context,model).optLong("receivedBytes")>before);
                // Notification pause is immediate on the main thread. The bridge
                // acknowledgement waits on its I/O thread through durable close
                // and service teardown, allowing Resume immediately afterward.
                CalendarModelTransferService.pause(context,model.id);JSONObject paused=CalendarModelTransferService.awaitPause(context,model.id,5000);assertEquals("paused",paused.getString("phase"));assertFalse(paused.getBoolean("active"));assertTrue(paused.getLong("resumeBytes")>0);assertTrue(storage.partial().isFile());
                scenario.moveToState(Lifecycle.State.RESUMED);scenario.recreate();
                // No sleep/retry barrier: the pause acknowledgement owns readiness.
                start(scenario,model);JSONObject installed=await(context,model,"installed",30);assertTrue(installed.getBoolean("verified"));assertArrayEquals(bytes,Files.readAllBytes(storage.destination().toPath()));assertTrue(requests.stream().anyMatch(request->request.startsWith("Range: bytes=")));
            }finally{
                stop.set(true);server.close();CalendarModelTransferService.pause(context,model.id);storage.destination().delete();new File(storage.destination().getParentFile(),id+".verified.json").delete();
                File[] transferFiles=storage.partial().getParentFile().listFiles((directory,name)->name.startsWith(model.key));if(transferFiles!=null)for(File file:transferFiles)file.delete();responder.join(2000);
            }
        }
    }
}
