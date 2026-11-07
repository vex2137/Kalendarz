package com.kalendarz.offline;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@CapacitorPlugin(name="CalendarGpuDiagnostics")
public class CalendarGpuDiagnosticsPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean();
    private final NativeProbeRunner runner=new NativeProbeRunner();
    private void execute(PluginCall call,boolean compute){
        if(!busy.compareAndSet(false,true)){call.reject("vulkan-probe-busy");return;}
        try{worker.execute(()->{try{
            long started=System.nanoTime();
            File binary=new File(getContext().getApplicationInfo().nativeLibraryDir,"libcalendar_gpu_probe.so");
            JSONObject result;
            if(!binary.isFile()||!binary.canExecute())result=NativeProbeRunner.failure("packaging","vulkan-probe-not-packaged");
            else result=runner.run(new ProcessBuilder(binary.getAbsolutePath(),compute?"--compute":"--discover"),6000);
            if(compute&&result.optBoolean("success")&&(result.optJSONObject("compute")==null||!result.getJSONObject("compute").optBoolean("verified")))result=NativeProbeRunner.failure("result-verify","vulkan-result-unverified");
            result.put("processDurationMs",(System.nanoTime()-started)/1e6);
            call.resolve(new JSObject(result.toString()));
        }catch(Exception error){call.reject("vulkan-probe-response");}finally{busy.set(false);}});}catch(RejectedExecutionException error){busy.set(false);call.reject("vulkan-probe-cancelled");}
    }
    @PluginMethod public void discover(PluginCall call){execute(call,false);}
    @PluginMethod public void testCompute(PluginCall call){if(!Boolean.TRUE.equals(call.getBoolean("confirmed",false))){call.reject("vulkan-compute-confirmation-required");return;}execute(call,true);}
    @Override protected void handleOnDestroy(){runner.cancel();worker.shutdownNow();super.handleOnDestroy();}
}
