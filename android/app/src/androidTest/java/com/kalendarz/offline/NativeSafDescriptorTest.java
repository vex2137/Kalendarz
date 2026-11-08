package com.kalendarz.offline;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.system.*;
import java.io.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Requires Android. Compiling this test is not evidence of POCO/provider access. */
@RunWith(AndroidJUnit4.class)
public class NativeSafDescriptorTest {
    @Test public void applicationOwnsOneEngineAcrossBridgeInstances(){Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();assertSame(CalendarNativeAIPlugin.engineFor(c),CalendarNativeAIPlugin.engineFor(c.getApplicationContext()));}
    @Test public void childCanReadParentHeldSeekableDescriptorWithoutCopying()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();File file=File.createTempFile("gguf-fd-",".fixture",c.getCacheDir());
        try{try(FileOutputStream out=new FileOutputStream(file)){out.write(new byte[]{71,71,85,70,3,0,0,0});}
            try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY)){assertEquals(0,Os.lseek(fd.getFileDescriptor(),0,OsConstants.SEEK_SET));Process child=new ProcessBuilder("/system/bin/cat","/proc/"+android.os.Process.myPid()+"/fd/"+fd.getFd()).start();ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=child.getInputStream()){byte[] b=new byte[32];int n;while((n=in.read(b))!=-1)bytes.write(b,0,n);}assertTrue(child.waitFor(3,java.util.concurrent.TimeUnit.SECONDS));assertEquals(0,child.exitValue());assertArrayEquals(new byte[]{71,71,85,70,3,0,0,0},bytes.toByteArray());}
        }finally{assertTrue(file.delete());}
    }
    @Test public void pipesAreNotSeekableAndMustNotTriggerAutomaticModelCopies()throws Exception{ParcelFileDescriptor[] pipe=ParcelFileDescriptor.createPipe();try{try{Os.lseek(pipe[0].getFileDescriptor(),0,OsConstants.SEEK_SET);fail("Pipe accepted as seekable model");}catch(ErrnoException expected){assertEquals(OsConstants.ESPIPE,expected.errno);}}finally{pipe[0].close();pipe[1].close();}}
}
