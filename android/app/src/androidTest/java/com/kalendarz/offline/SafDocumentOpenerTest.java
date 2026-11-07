package com.kalendarz.offline;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.ContentResolver;
import android.net.Uri;
import java.io.InputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SafDocumentOpenerTest {
    private Uri uri(String name) {
        return Uri.parse("content://com.kalendarz.offline.saf.open.fixture/"+name);
    }
    @Test public void rawOpenStreamsWhenTypedAssetOpenIsDenied() throws Exception {
        ContentResolver resolver=InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
        try(InputStream ignored=resolver.openInputStream(uri("model"))) {fail("Typed route should be rejected");}
        catch(SecurityException expected) {}
        // openFileDescriptor("r") uses the same rejected typed route on Android 16.
        try(android.os.ParcelFileDescriptor ignored=resolver.openFileDescriptor(uri("model"),"r")) {fail("Resolver PFD must not be mistaken for raw provider open");}
        catch(SecurityException expected) {}
        long bytes=0;
        try(SafImportSession session=new SafImportSession(SafDocumentOpener.openRawDocument(resolver,uri("model")),8L*1024*1024)) {
            byte[] chunk;
            while((chunk=session.read()).length>0){assertTrue(chunk.length<=256*1024);bytes+=chunk.length;}
        }
        assertEquals(8L*1024*1024,bytes);
    }
    @Test public void rawOpenDoesNotSuppressProviderDenialOrAcceptFilePaths() throws Exception {
        ContentResolver resolver=InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
        try(InputStream ignored=SafDocumentOpener.openRawDocument(resolver,uri("denied"))) {fail("Must preserve raw provider SecurityException");}
        catch(SecurityException expected) {}
        try(InputStream ignored=SafDocumentOpener.openRawDocument(resolver,Uri.parse("file:///private/fixture.gguf"))) {fail("Only content URIs");}
        catch(java.io.IOException expected) {assertEquals("model-import-file",expected.getMessage());}
    }
    @Test public void downloadsDenialDoesNotChangeWorkingDocumentsStream() throws Exception {
        ContentResolver resolver=InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
        try(InputStream ignored=resolver.openInputStream(uri("downloads"))) {fail("Fixture Downloads denies typed open");}catch(SecurityException expected) {}
        try(InputStream ignored=SafDocumentOpener.openRawDocument(resolver,uri("downloads"))) {fail("Fixture Downloads denies raw open too");}catch(SecurityException expected) {}
        java.security.MessageDigest expectedHash=java.security.MessageDigest.getInstance("SHA-256"),actualHash=java.security.MessageDigest.getInstance("SHA-256");
        try(SafImportSession source=new SafImportSession(SafDocumentOpener.openRawDocument(resolver,uri("model")),8L*1024*1024);
            SafImportSession documents=new SafImportSession(resolver.openInputStream(uri("documents")),8L*1024*1024)) {
            byte[] chunk;long total=0;
            while((chunk=source.read()).length>0)expectedHash.update(chunk);
            while((chunk=documents.read()).length>0){assertTrue(chunk.length<=256*1024);actualHash.update(chunk);total+=chunk.length;}
            assertEquals(8L*1024*1024,total);assertArrayEquals(expectedHash.digest(),actualHash.digest());
        }
    }
    @Test public void recoveryRequestsNewSystemSelectionWithoutRewritingFileUri() throws Exception {
        android.content.Intent normal=CalendarModelImportPlugin.pickerIntent(false);
        android.content.Intent retry=CalendarModelImportPlugin.pickerIntent(true);
        assertEquals(android.content.Intent.ACTION_OPEN_DOCUMENT,normal.getAction());assertEquals(normal.getAction(),retry.getAction());
        assertFalse(normal.hasExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI));
        assertTrue(retry.hasCategory(android.content.Intent.CATEGORY_OPENABLE));
        assertEquals(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,retry.getFlags());
        Uri hint=retry.getParcelableExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI);
        assertEquals("com.android.externalstorage.documents",hint.getAuthority());
        assertEquals("primary:Download",android.provider.DocumentsContract.getDocumentId(hint));
        assertEquals("media-file",CalendarModelImportPlugin.documentFamily(Uri.parse("content://com.android.providers.downloads.documents/document/msf%3A123")));
        assertEquals("primary-volume",CalendarModelImportPlugin.documentFamily(Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fprivate.gguf")));
    }

}
