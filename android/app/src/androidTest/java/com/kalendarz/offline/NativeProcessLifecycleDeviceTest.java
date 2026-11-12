package com.kalendarz.offline;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;

/** Exercises Android's actual UNIXProcess and explicit signal escalation. */
@RunWith(AndroidJUnit4.class)
public class NativeProcessLifecycleDeviceTest {
    @Test public void forceStopsOwnedTermIgnoringProcessWithoutClosingLivePipes()throws Exception {
        Process p=new ProcessBuilder("/system/bin/sh","-c","trap '' TERM; echo ready; exec /system/bin/sleep 60").start();
        try {
            assertEquals("ready",new BufferedReader(new InputStreamReader(p.getInputStream())).readLine());
            NativeProcessLifecycle.stop(p,NativeInferenceEngine::signalOwnedChild,50,3000);
            assertFalse(p.isAlive());assertNotEquals(0,p.exitValue());
        }finally{NativeProcessLifecycle.stop(p,NativeInferenceEngine::signalOwnedChild,50,3000);}
    }
}
