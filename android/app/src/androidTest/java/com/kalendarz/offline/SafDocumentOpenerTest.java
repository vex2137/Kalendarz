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
}
