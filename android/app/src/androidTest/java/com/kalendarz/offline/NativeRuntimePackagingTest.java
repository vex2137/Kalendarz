package com.kalendarz.offline;

import static org.junit.Assert.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.concurrent.*;

/** Run on an ARM64 Android 9+ test device. Enumeration is not an inference benchmark. */
@RunWith(AndroidJUnit4.class)
public class NativeRuntimePackagingTest {
    @Test public void packagedRuntimeExecutesAndReportsPinnedVersion() throws Exception {
        File binary=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationInfo().nativeLibraryDir,"libcalendar_llama.so");
        assertTrue("Build with CALENDAR_ANDROID_NATIVE=true and the staged ARM64 runtime",binary.isFile());
        assertTrue("Package Manager must extract an executable native library",binary.canExecute());
        Process child=new ProcessBuilder(binary.getAbsolutePath(),"--version").redirectErrorStream(true).start();
        try {
            assertTrue("Native runtime did not exit",child.waitFor(20,TimeUnit.SECONDS));
            ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;
            try(InputStream in=child.getInputStream()){while((n=in.read(b))!=-1){assertTrue(output.size()+n<128*1024);output.write(b,0,n);}}
            assertEquals(output.toString("UTF-8"),0,child.exitValue());
            assertTrue(output.toString("UTF-8"),output.toString("UTF-8").contains("620d2225"));
        } finally {child.destroyForcibly();}
    }
}
