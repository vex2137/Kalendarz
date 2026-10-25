package com.kalendarz.offline;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.WebResourceResponse;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** SAF grants are streamed to OPFS; no filesystem path or base64 model crosses the bridge. */
@CapacitorPlugin(name = "CalendarModelImport")
public class CalendarModelImportPlugin extends Plugin {
    private final java.util.concurrent.ExecutorService io = java.util.concurrent.Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String, Uri> files = new ConcurrentHashMap<>();

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(call, intent, "modelPicked"); }
        catch (Exception error) { call.reject("model-import-file", error); }
    }

    @ActivityCallback
    private void modelPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject(); cancelled.put("cancelled", true); call.resolve(cancelled); return;
        }
        Uri uri = result.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { call.reject("model-import-file"); return; }
        io.execute(() -> {
        try {
            String name="model.gguf";long bytes=-1;
            try (Cursor cursor=getContext().getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)) {
                if(cursor!=null&&cursor.moveToFirst()){
                    int ni=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME),si=cursor.getColumnIndex(OpenableColumns.SIZE);
                    if(ni>=0&&!cursor.isNull(ni))name=cursor.getString(ni);
                    if(si>=0&&!cursor.isNull(si))bytes=cursor.getLong(si);
                }
            }catch(Exception metadataError){android.util.Log.w("CalendarModelImport","picker metadata unavailable; streaming determines size: "+metadataError.getClass().getSimpleName());}
            if(bytes<0){
                try(android.os.ParcelFileDescriptor fd=getContext().getContentResolver().openFileDescriptor(uri,"r")){if(fd!=null)bytes=fd.getStatSize();}
                catch(Exception statError){android.util.Log.w("CalendarModelImport","document size unavailable; streaming determines size: "+statError.getClass().getSimpleName());}
            }
            if(bytes==0)throw new IllegalArgumentException("Empty document");
            String token = UUID.randomUUID().toString(); files.put(token, uri);
            android.util.Log.i("CalendarModelImport","picker granted; sizeKnown="+(bytes>0));
            JSObject file = new JSObject(); file.put("token", token); file.put("name", name); file.put("bytes", bytes);
            call.resolve(file);
        } catch (Exception error) {android.util.Log.e("CalendarModelImport","picker failed: "+error.getClass().getSimpleName());call.reject("model-import-file", error); }
        });
    }

    @PluginMethod
    public void release(PluginCall call) { files.remove(call.getString("token", "")); call.resolve(); }

    static WebResourceResponse intercept(android.content.Context context, Uri url) {
        if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost()) || url.getPort() != -1 || !url.getPath().startsWith("/_calendar_model_import/")) return null;
        Uri file = files.get(url.getLastPathSegment());
        try {
            if (file == null) throw new IllegalArgumentException("Expired import token");
            android.util.Log.i("CalendarModelImport","opening SAF input stream");
            return new WebResourceResponse("application/octet-stream", null, 200, "OK",
                Collections.singletonMap("Cache-Control", "no-store"), context.getContentResolver().openInputStream(file));
        } catch (Exception error) {
            android.util.Log.e("CalendarModelImport","stream-open failed: "+error.getClass().getSimpleName());
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    protected void handleOnDestroy() { files.clear(); io.shutdownNow(); }
}
