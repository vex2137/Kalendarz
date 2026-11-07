package com.kalendarz.offline;

import static org.junit.Assert.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Run on an ARM64 Android 9+ test device. Enumeration is not an inference benchmark. */
@RunWith(AndroidJUnit4.class)
public class NativeRuntimePackagingTest {
    private File binary(){
        return new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationInfo().nativeLibraryDir,"libcalendar_llama.so");
    }
    private String runRuntime(String argument) throws Exception {
        Process child=CalendarNativeAIPlugin.nativeProcessBuilder(binary(),Collections.singletonList(argument)).start();
        ExecutorService reader=Executors.newSingleThreadExecutor();
        Future<String> output=reader.submit(()->{
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;
            try(InputStream in=child.getInputStream()){while((n=in.read(b))!=-1){if(bytes.size()+n>128*1024)throw new IOException("Native output limit");bytes.write(b,0,n);}}
            return bytes.toString("UTF-8");
        });
        try {
            assertTrue("Native runtime did not exit",child.waitFor(20,TimeUnit.SECONDS));
            String text=output.get(3,TimeUnit.SECONDS);assertEquals(text,0,child.exitValue());return text;
        } finally {child.destroyForcibly();reader.shutdownNow();}
    }
    @Test public void packagedRuntimeIsAnExtractedArm64Executable() throws Exception {
        File binary=binary();
        assertTrue("Build with CALENDAR_ANDROID_NATIVE=true and the staged ARM64 runtime",binary.isFile());
        assertTrue("Package Manager must extract an executable native library",binary.canExecute());
        byte[] elf=new byte[20];try(DataInputStream in=new DataInputStream(new FileInputStream(binary))){in.readFully(elf);}
        assertArrayEquals(new byte[]{0x7f,'E','L','F',2,1},Arrays.copyOf(elf,6));
        assertEquals("PIE executable (ET_DYN)",3,elf[16]&255);assertEquals(0,elf[17]);
        assertEquals("AArch64 (EM_AARCH64)",183,elf[18]&255);assertEquals(0,elf[19]);
    }
    @Test public void packagedRuntimeExecutesAndReportsPinnedVersion() throws Exception {
        assertTrue(runRuntime("--version").contains("620d2225"));
    }
    @Test public void productionLauncherCanEnumerateDevicesWithoutClaimingInference() throws Exception {
        // An empty list is valid. This checks the ABI/linker/probe path, not Vulkan inference.
        assertTrue(runRuntime("--list-devices").contains("Available devices:"));
    }
}
