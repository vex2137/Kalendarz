package com.kalendarz.offline;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.*;
import org.json.JSONObject;

@CapacitorPlugin(name="CalendarModelFolders")
public final class CalendarModelFoldersPlugin extends Plugin {
    private static AndroidModelFolders registry;
    static synchronized AndroidModelFolders store(Context context){if(registry==null)registry=new AndroidModelFolders(context);return registry;}
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private interface Task{JSONObject run()throws Exception;}
    private void perform(PluginCall call,Task task){worker.execute(()->{try{call.resolve(new JSObject(task.run().toString()));}catch(Exception e){call.reject(e.getMessage()!=null&&e.getMessage().startsWith("model-")?e.getMessage():"model-folder-read",e);}});}
    @PluginMethod public void list(PluginCall call){perform(call,()->store(getContext()).refresh());}
    @PluginMethod public void refresh(PluginCall call){perform(call,()->store(getContext()).refresh());}
    @PluginMethod public void remove(PluginCall call){perform(call,()->store(getContext()).remove(call.getString("id")));}
    @PluginMethod public void forget(PluginCall call){perform(call,()->store(getContext()).forget(call.getString("id")));}
    @PluginMethod public void relink(PluginCall call){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(call,intent,"fileRelinked");}
    @ActivityCallback private void fileRelinked(PluginCall call,ActivityResult result){if(call==null)return;Intent data=result.getData();Uri uri=data==null?null:data.getData();if(result.getResultCode()!=Activity.RESULT_OK||uri==null){call.reject("model-folder-cancelled");return;}try{getContext().getContentResolver().takePersistableUriPermission(uri,data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(SecurityException ignored){}perform(call,()->store(getContext()).relink(call.getString("id"),uri));}
    @PluginMethod public void add(PluginCall call){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);startActivityForResult(call,intent,"folderPicked");}
    @ActivityCallback private void folderPicked(PluginCall call,ActivityResult result){
        if(call==null)return;Intent data=result.getData();Uri uri=data==null?null:data.getData();
        if(result.getResultCode()!=Activity.RESULT_OK||uri==null){call.reject("model-folder-cancelled");return;}
        try{getContext().getContentResolver().takePersistableUriPermission(uri,data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(SecurityException ignored){/* Temporary grants remain usable; loss is shown on refresh. */}
        perform(call,()->store(getContext()).add(uri));
    }
}
