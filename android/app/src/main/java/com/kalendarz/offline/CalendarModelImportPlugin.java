package com.kalendarz.offline;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.provider.DocumentsContract;
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
    private volatile boolean destroyed;
    private final Set<String> ownedTokens = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<String, JSObject> grantDiagnostics = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, SafImportSession> streams = new ConcurrentHashMap<>();

    private static String errorCode(Exception error) {
        if (error instanceof SecurityException) return "model-import-permission";
        if (error instanceof FileNotFoundException) return "model-import-unavailable";
        String message = error.getMessage();
        if (message != null && message.matches("model-(import-(expired|unavailable|incomplete|file)|gguf-invalid|size)")) return message;
        return "model-import-read";
    }

    private void reject(PluginCall call, String stage, Exception error) {
        String code = errorCode(error);
        // Provider messages and document URIs may contain private paths. Keep only safe codes/types.
        android.util.Log.e("CalendarModelImport", stage + " failed: " + code + "; type=" + error.getClass().getSimpleName());
        JSObject detail = failureDetail(stage, error);
        JSObject grant = grantDiagnostics.get(call.getString("token", ""));
        if (grant != null) detail.put("grant", grant);
        call.reject(code, code, null, new JSObject().put("saf", detail));
    }

    static JSObject failureDetail(String stage, Exception error) {
        JSObject detail = new JSObject().put("stage", stage).put("exceptionType", error.getClass().getName());
        com.getcapacitor.JSArray frames = new com.getcapacitor.JSArray();
        for (StackTraceElement frame : error.getStackTrace()) {
            if (frames.length() >= 8) break;
            frames.put(frame.getClassName() + "." + frame.getMethodName());
        }
        detail.put("frames", frames);
        return detail;
    }

    private SafImportSession openDocument(Uri uri, long bytes, JSObject evidence, PluginCall call) {
        InputStream input = null;
        String stage = "uri-validation";
        try {
            if (uri == null || !"content".equals(uri.getScheme()) || uri.getAuthority() == null || uri.getAuthority().isEmpty()) throw new IOException("model-import-file");
            if (evidence != null && evidence.optBoolean("virtualDocument")) throw new IOException("model-import-file");
            boolean raw = DocumentsContract.isDocumentUri(getContext(), uri) && "com.android.providers.downloads.documents".equals(uri.getAuthority());
            stage = raw ? "provider-open-file" : "resolver-open";
            if (evidence != null) evidence.put("openMethod", raw ? "provider-open-file" : "resolver-input-stream");
            // Both routes retain the exact URI and the Activity's application attribution.
            input = raw ? SafDocumentOpener.openRawDocument(getActivity().getContentResolver(), uri)
                        : getActivity().getContentResolver().openInputStream(uri);
            stage = "header-read";
            SafImportSession session = new SafImportSession(input, bytes);
            return session;
        } catch (Exception error) {
            if (input != null) try { input.close(); } catch (Exception ignored) {}
            JSObject detail = failureDetail(stage, error);
            if (evidence != null) detail.put("grant", evidence);
            android.util.Log.e("CalendarModelImport", "SAF failure " + detail.toString());
            call.reject(errorCode(error), errorCode(error), null, new JSObject().put("saf", detail));
            return null;
        }
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
                if (streams.containsKey(token)) { call.resolve(); return; }
                SafImportSession session = openDocument(uri, call.getLong("bytes", -1L), grantDiagnostics.get(token), call);
                if (session == null) return;
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
        Uri selected = result.getData().getData();
        android.content.ClipData clip = result.getData().getClipData();
        if (selected == null && clip != null && clip.getItemCount() == 1) selected = clip.getItemAt(0).getUri();
        final Uri uri = selected;
        if (uri == null || !"content".equals(uri.getScheme()) || uri.getAuthority() == null || uri.getAuthority().isEmpty()) { reject(call, "uri-validation", new IOException("model-import-file")); return; }
        final int flags = result.getData().getFlags();
        final JSObject grant = new JSObject()
            .put("isDocument", DocumentsContract.isDocumentUri(getContext(), uri))
            .put("fromClipData", result.getData().getData() == null)
            .put("sameUid", getContext().getApplicationInfo().uid == android.os.Process.myUid())
            .put("package", getContext().getPackageName())
            .put("readFlag", (flags & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0)
            .put("persistableFlag", (flags & Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION) != 0)
            .put("readGranted", getActivity().checkUriPermission(uri, android.os.Process.myPid(), android.os.Process.myUid(), Intent.FLAG_GRANT_READ_URI_PERMISSION) == android.content.pm.PackageManager.PERMISSION_GRANTED)
            .put("provider", "com.android.providers.downloads.documents".equals(uri.getAuthority()) ? "downloads" : "com.android.externalstorage.documents".equals(uri.getAuthority()) ? "external-storage" : "other");
        io.execute(() -> {
        try {
            String name="model.gguf";long bytes=-1;
            try (Cursor cursor=getActivity().getContentResolver().query(uri, DocumentsContract.isDocumentUri(getContext(), uri) ? new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE,DocumentsContract.Document.COLUMN_FLAGS} : new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)) {
                if(cursor!=null&&cursor.moveToFirst()){
                    int ni=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME),si=cursor.getColumnIndex(OpenableColumns.SIZE);
                    if(ni>=0&&!cursor.isNull(ni))name=cursor.getString(ni);
                    if(si>=0&&!cursor.isNull(si))bytes=cursor.getLong(si);
                    int fi=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS);
                    if(fi>=0&&!cursor.isNull(fi))grant.put("virtualDocument", (cursor.getLong(fi)&DocumentsContract.Document.FLAG_VIRTUAL_DOCUMENT)!=0);
                }
            }catch(Exception metadataError){android.util.Log.w("CalendarModelImport","picker metadata unavailable; streaming determines size: "+metadataError.getClass().getSimpleName());}
            if(bytes==0)throw new IOException("model-size");
            // Acquire access before handing control back to WebView/lifecycle callbacks.
            // ACTION_OPEN_DOCUMENT's temporary read grant is sufficient; no storage-wide
            // permission or permanent grant is requested for a one-shot import.
            SafImportSession session = openDocument(uri, bytes, grant, call);
            if (session == null) return;
            String token = UUID.randomUUID().toString();
            synchronized (this) {
                if (destroyed) { session.close(); throw new IOException("model-import-expired"); }
                files.put(token, uri); ownedTokens.add(token);
                streams.put(token, session); grantDiagnostics.put(token, grant);
            }
            android.util.Log.i("CalendarModelImport","picker stream acquired; " + grant.toString());
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
            grantDiagnostics.remove(token);
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
            InputStream input = DocumentsContract.isDocumentUri(context, file) && "com.android.providers.downloads.documents".equals(file.getAuthority())
                ? SafDocumentOpener.openRawDocument(context.getContentResolver(), file) : context.getContentResolver().openInputStream(file);
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
        destroyed = true;
        synchronized (this) {
            for (String token : ownedTokens) { closeStream(token); files.remove(token); }
            ownedTokens.clear(); grantDiagnostics.clear();
        }
        io.shutdownNow();
    }
}
