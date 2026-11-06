package com.kalendarz.offline;

import android.content.ContentProviderClient;
import android.content.ContentResolver;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.FilterInputStream;
import java.io.InputStream;
import java.io.IOException;

/** Whole-document SAF bytes; never resolves a content URI to a filesystem path. */
final class SafDocumentOpener {
    static InputStream openRawDocument(ContentResolver resolver, Uri uri) throws Exception {
        if (uri == null || !"content".equals(uri.getScheme()) || uri.getAuthority() == null || uri.getAuthority().isEmpty())
            throw new IOException("model-import-file");
        ContentProviderClient client = resolver.acquireContentProviderClient(uri);
        if (client == null) throw new java.io.FileNotFoundException("model-import-unavailable");
        ParcelFileDescriptor descriptor = null;
        try {
            // Resolver.openFileDescriptor("r") also dispatches openTypedAssetFile
            // on Android 16. Client.openFile uses the provider's raw openFile API.
            descriptor = client.openFile(uri, "r", null);
            if (descriptor == null) throw new java.io.FileNotFoundException("model-import-unavailable");
            final ContentProviderClient owner = client;
            InputStream stream = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
            return new FilterInputStream(stream) {
                private boolean closed;
                @Override public synchronized void close() throws IOException {
                    if (closed) return;
                    closed = true;
                    try { super.close(); } finally { owner.close(); }
                }
            };
        } catch (Exception failure) {
            if (descriptor != null) try { descriptor.close(); } catch (IOException ignored) {}
            client.close();
            throw failure;
        }
    }
}
