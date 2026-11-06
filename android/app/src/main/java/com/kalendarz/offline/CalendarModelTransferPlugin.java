package com.kalendarz.offline;

import android.util.Base64;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.util.UUID;
import java.util.concurrent.*;

/** Thin bridge: lifecycle-independent work is owned by the dataSync service. */
@CapacitorPlugin(name="CalendarModelTransfer")
public class CalendarModelTransferPlugin extends Plugin {
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final ModelTransferCore.Observer observer=state->{try{notifyListeners("progress",JSObject.fromJSONObject(state));}catch(Exception impossible){android.util.Log.w("CalendarModelTransfer","progress serialization failed");}};
    private Seed seed;
    private interface Task { JSONObject run() throws Exception; }
    private void submit(PluginCall call,Task task){io.execute(()->{try{call.resolve(JSObject.fromJSONObject(task.run()));}catch(Exception failure){String code=failure.getMessage();call.reject(code!=null&&code.startsWith("model-")?code:"model-download",failure);}});}
    private ModelTransferCore.Model model(PluginCall call)throws Exception{return new ModelTransferCore.Model(call.getObject("model"));}
    @Override public void load(){CalendarModelTransferService.listen(observer);}
    @PluginMethod public void start(PluginCall call){
        if(getActivity()==null||getActivity().isFinishing()||!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)){call.reject("model-download-background");return;}
        submit(call,()->{if(seed!=null)throw new Exception("model-busy");return CalendarModelTransferService.start(getContext(),model(call),call.getString("language","en"));});
    }
    @PluginMethod public void status(PluginCall call){submit(call,()->CalendarModelTransferService.status(getContext(),call.getObject("model")==null?null:model(call)));}
    @PluginMethod public void pause(PluginCall call){submit(call,()->CalendarModelTransferService.awaitPause(getContext(),call.getString("modelId"),5000));}
    private static final class Seed {String token,etag;long expected,bytes;ModelTransferCore core;File file;FileOutputStream output;}
    @PluginMethod public void seedBegin(PluginCall call){submit(call,()->{
        if(seed!=null||CalendarModelTransferService.busy())throw new Exception("model-busy");
        ModelTransferCore.Model model=model(call);String etag=ModelTransferCore.strongETag(call.getString("etag"));Long bytes=call.getLong("bytes");
        if(model.url.isEmpty()||etag==null||bytes==null||bytes<=0||bytes>model.bytes)throw new Exception("model-input");
        ModelTransferCore core=new ModelTransferCore(getContext().getFilesDir(),model,state->{});if(core.hasSeed(bytes,etag))return new JSONObject().put("exists",true);
        if(getContext().getFilesDir().getUsableSpace()<bytes+64L*1024*1024)throw new Exception("model-storage-space");
        Seed upload=new Seed();upload.token=UUID.randomUUID().toString();upload.etag=etag;upload.expected=bytes;upload.core=core;upload.file=new File(core.partial().getParentFile(),upload.token+".seed");upload.output=new FileOutputStream(upload.file);seed=upload;
        return new JSONObject().put("token",upload.token);
    });}
    private Seed seed(PluginCall call)throws Exception{if(seed==null||!seed.token.equals(call.getString("token")))throw new Exception("model-upload");return seed;}
    @PluginMethod public void seedWrite(PluginCall call){submit(call,()->{
        Seed upload=seed(call);String encoded=call.getString("data","");if(encoded.length()>350000)throw new Exception("model-input");byte[] data=Base64.decode(encoded,Base64.NO_WRAP);
        if(data.length>ModelTransferCore.BUFFER||upload.bytes+data.length>upload.expected)throw new Exception("model-size");upload.output.write(data);upload.bytes+=data.length;return new JSONObject().put("bytes",upload.bytes);
    });}
    @PluginMethod public void seedFinish(PluginCall call){submit(call,()->{
        Seed upload=seed(call);if(upload.bytes!=upload.expected)throw new Exception("model-size");upload.output.getFD().sync();upload.output.close();upload.core.commitSeed(upload.file,upload.expected,upload.etag);seed=null;return new JSONObject().put("bytes",upload.bytes);
    });}
    @PluginMethod public void seedAbort(PluginCall call){submit(call,()->{Seed upload=seed(call);upload.output.close();upload.file.delete();seed=null;return new JSONObject();});}
    @Override protected void handleOnDestroy(){
        CalendarModelTransferService.unlisten(observer);
        io.execute(()->{if(seed!=null){try{seed.output.close();}catch(IOException ignored){}seed.file.delete();seed=null;}});io.shutdown();
        // Deliberately do not pause the service when its initiating WebView is destroyed.
    }
}
