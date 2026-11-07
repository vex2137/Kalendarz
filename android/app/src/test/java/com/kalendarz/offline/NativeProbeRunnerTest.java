package com.kalendarz.offline;
import org.junit.Test;
import org.json.JSONObject;
import static org.junit.Assert.*;

public class NativeProbeRunnerTest {
    private JSONObject shell(String script,long timeout)throws Exception{return new NativeProbeRunner().run(new ProcessBuilder("sh","-c",script),timeout);}
    @Test public void acceptsStructuredNativeResult()throws Exception{assertTrue(shell("printf '%s' '{\"version\":1,\"success\":true,\"stage\":\"discovered\"}'",1000).getBoolean("success"));}
    @Test public void preservesDriverFailureStageAndVkResult()throws Exception{JSONObject r=shell("printf '%s' '{\"version\":1,\"success\":false,\"stage\":\"instance-create\",\"vkResult\":-9}'; exit 2",1000);assertFalse(r.getBoolean("success"));assertEquals("instance-create",r.getString("stage"));assertEquals(-9,r.getInt("vkResult"));assertEquals(2,r.getInt("exitCode"));}
    @Test public void rejectsSuccessFromFailedProcess()throws Exception{assertEquals("vulkan-probe-exit",shell("printf '%s' '{\"version\":1,\"success\":true,\"stage\":\"discovered\"}'; exit 1",1000).getString("errorCode"));}
    @Test public void killsHungHelperWithoutWaitingForDriver()throws Exception{JSONObject r=shell("exec sleep 2",30);assertFalse(r.getBoolean("success"));assertEquals("vulkan-probe-timeout",r.getString("errorCode"));}
    @Test public void rejectsInvalidJsonAndMissingProtocol()throws Exception{assertFalse(shell("printf invalid",1000).getBoolean("success"));assertEquals("protocol",shell("printf '{}'",1000).getString("stage"));}
    @Test public void outputIsBounded()throws Exception{assertFalse(shell("head -c 140000 /dev/zero",1000).getBoolean("success"));}
    @Test public void cancellationPreventsNewProcess()throws Exception{NativeProbeRunner runner=new NativeProbeRunner();runner.cancel();assertEquals("vulkan-probe-cancelled",runner.run(new ProcessBuilder("invalid-command-must-not-start"),1000).getString("errorCode"));}
    @Test public void unavailableExecutableDoesNotCrashCaller()throws Exception{assertFalse(new NativeProbeRunner().run(new ProcessBuilder("/nonexistent-calendar-helper"),1000).getBoolean("success"));}
}
