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
import java.util.HashMap;
import java.util.Set;
import java.io.InputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import android.util.Base64;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** SAF stays native; bounded chunks feed OPFS without a WebView HTTP interception dependency. */
@CapacitorPlugin(name = "CalendarModelImport")
public class CalendarModelImportPlugin extends Plugin {
    private final java.util.concurrent.ExecutorService io = java.util.concurrent.Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String, Uri> files = new ConcurrentHashMap<>();
    private final Set<String> ownedTokens = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<String, SafImportSession> streams = new ConcurrentHashMap<>();

    private static String errorCode(Exception error) {
        if (error instanceof SecurityException) return "model-import-permission";
        if (error instanceof FileNotFoundException) return "model-import-unavailable";
        String message = error.getMessage();
        if (message != null && message.matches("model-(import-(expired|unavailable|incomplete)|gguf-invalid|size)")) return message;
        return "model-import-read";
    }

    private void reject(PluginCall call, String stage, Exception error) {
        String code = errorCode(error);
        // Provider messages and document URIs may contain private paths. Keep only safe codes/types.
        android.util.Log.e("CalendarModelImport", stage + " failed: " + code + "; type=" + error.getClass().getSimpleName());
        call.reject(code);
    }

    private void closeStream(String token) {
        SafImportSession stream = streams.remove(token);
        if (stream != null) try { stream.close(); } catch (Exception ignored) {}
    }

    @PluginMethod
    public void open(PluginCall call) {
        String token = call.getString("token", "");
        io.execute(() -> {
            try {
                Uri uri = ownedTokens.contains(token) ? files.get(token) : null;
                if (uri == null) throw new IOException("model-import-expired");
                closeStream(token);
                SafImportSession session = new SafImportSession(getContext().getContentResolver().openInputStream(uri), call.getLong("bytes", -1L));
                synchronized (this) {
                    if (!ownedTokens.contains(token)) { session.close(); throw new IOException("model-import-expired"); }
                    streams.put(token, session);
                }
                android.util.Log.i("CalendarModelImport", "SAF stream opened; transport=native-chunks; header=GGUF");
                call.resolve();
            } catch (Exception error) { reject(call, "stream-open", error); }
        });
    }

    @PluginMethod
    public void read(PluginCall call) {
        String token = call.getString("token", "");
        io.execute(() -> {
            try {
                SafImportSession session = streams.get(token);
                if (session == null || !ownedTokens.contains(token)) throw new IOException("model-import-expired");
                byte[] bytes = session.read();
                JSObject chunk = new JSObject();
                chunk.put("done", bytes.length == 0);
                chunk.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
                chunk.put("received", session.receivedBytes());
                if (bytes.length == 0) streams.remove(token, session);
                call.resolve(chunk);
            } catch (Exception error) { closeStream(token); reject(call, "copy", error); }
        });
    }

    @PluginMethod
    public void close(PluginCall call) { closeStream(call.getString("token", "")); call.resolve(); }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(call, intent, "modelPicked"); }
        catch (Exception error) { reject(call, "picker", error); }
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
            if(bytes==0)throw new IOException("model-size");
            String token = UUID.randomUUID().toString(); files.put(token, uri); ownedTokens.add(token);
            android.util.Log.i("CalendarModelImport","picker granted; sizeKnown="+(bytes>0));
            JSObject file = new JSObject(); file.put("token", token); file.put("name", name); file.put("bytes", bytes);
            call.resolve(file);
        } catch (Exception error) { reject(call, "picker", error); }
        });
    }

    @PluginMethod
    public void release(PluginCall call) {
        String token = call.getString("token", "");
        synchronized (this) {
            if (ownedTokens.remove(token)) files.remove(token);
            closeStream(token);
        }
        call.resolve();
    }

    static WebResourceResponse intercept(android.content.Context context, Uri url) {
        if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost()) || url.getPort() != -1 || !url.getPath().startsWith("/_calendar_model_import/")) return null;
        Uri file = files.get(url.getLastPathSegment());
        try {
            if (file == null) throw new IOException("model-import-expired");
            android.util.Log.i("CalendarModelImport","opening SAF input stream");
            InputStream input = context.getContentResolver().openInputStream(file);
            if (input == null) throw new IOException("model-import-unavailable");
            return new WebResourceResponse("application/octet-stream", null, 200, "OK",
                Collections.singletonMap("Cache-Control", "no-store"), input);
        } catch (Exception error) {
            String code = errorCode(error);
            android.util.Log.e("CalendarModelImport","stream-open failed: " + code + "; type=" + error.getClass().getSimpleName());
            HashMap<String,String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store"); headers.put("X-Calendar-Import-Error", code);
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    protected void handleOnDestroy() {
        // An old Activity must never expire tokens created by its replacement.
        synchronized (this) {
            for (String token : ownedTokens) { closeStream(token); files.remove(token); }
            ownedTokens.clear();
        }
        io.shutdownNow();
    }
}
