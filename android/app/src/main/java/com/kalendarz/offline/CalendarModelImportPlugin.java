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
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) throw new IllegalArgumentException("No document metadata");
            String name = cursor.getString(0);
            long bytes = cursor.isNull(1) ? -1 : cursor.getLong(1);
            if (bytes < 0) {
                try (android.os.ParcelFileDescriptor fd = getContext().getContentResolver().openFileDescriptor(uri, "r")) {
                    if (fd != null) bytes = fd.getStatSize();
                }
            }
            if (bytes <= 0) throw new IllegalArgumentException("Document must be available locally");
            String token = UUID.randomUUID().toString(); files.put(token, uri);
            JSObject file = new JSObject(); file.put("token", token); file.put("name", name); file.put("bytes", bytes);
            call.resolve(file);
        } catch (Exception error) { call.reject("model-import-file", error); }
    }

    @PluginMethod
    public void release(PluginCall call) { files.remove(call.getString("token", "")); call.resolve(); }

    static WebResourceResponse intercept(android.content.Context context, Uri url) {
        if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost()) || url.getPort() != -1 || !url.getPath().startsWith("/_calendar_model_import/")) return null;
        Uri file = files.get(url.getLastPathSegment());
        try {
            if (file == null) throw new IllegalArgumentException("Expired import token");
            return new WebResourceResponse("application/octet-stream", null, 200, "OK",
                Collections.singletonMap("Cache-Control", "no-store"), context.getContentResolver().openInputStream(file));
        } catch (Exception error) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override
    protected void handleOnDestroy() { files.clear(); }
}
