package com.kalendarz.offline;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.util.concurrent.TimeUnit;

public class NativeProcessLifecycleTest {
    static final class AndroidLikeProcess extends Process {
        boolean alive=true,closed;int destroys;boolean refusesKill;
        private final ByteArrayInputStream input=new ByteArrayInputStream(new byte[0]){public void close(){closed=true;}};
        public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        public InputStream getInputStream(){return input;}
        public InputStream getErrorStream(){return input;}
        public int waitFor(){return 0;}
        public boolean waitFor(long n,TimeUnit unit){return !alive;}
        public int exitValue(){if(alive)throw new IllegalThreadStateException();return 0;}
        public boolean isAlive(){return alive;}
        public void destroy(){destroys++;} // inherited destroyForcibly only repeats TERM
        public String toString(){return "Process[pid=123 ,hasExited=false]";}
    }
    @Test public void escalatesExplicitlyInsteadOfRepeatingAndroidDestroy()throws Exception {
        AndroidLikeProcess p=new AndroidLikeProcess();StringBuilder signals=new StringBuilder();
        NativeProcessLifecycle.stop(p,(child,force)->{signals.append(force?'K':'T');if(force)p.alive=false;},0,0);
        assertEquals("TK",signals.toString());assertEquals(0,p.destroys);assertFalse(p.isAlive());assertTrue(p.closed);
    }
    @Test public void gracefulExitDoesNotForceKill()throws Exception {
        AndroidLikeProcess p=new AndroidLikeProcess();
        NativeProcessLifecycle.stop(p,(child,force)->{assertFalse(force);p.alive=false;},0,0);assertTrue(p.closed);
    }
    @Test public void timeoutNeverClosesLiveChildPipes()throws Exception {
        AndroidLikeProcess p=new AndroidLikeProcess();
        try{NativeProcessLifecycle.stop(p,(child,force)->{},0,0);fail();}catch(IOException error){assertEquals("model-stop-timeout",error.getMessage());}
        assertTrue(p.isAlive());assertFalse(p.closed);
        NativeProcessLifecycle.stop(p,(child,force)->p.alive=false,0,0);assertTrue(p.closed);
    }
    @Test public void alreadyExitedProcessNeedsNoSignal()throws Exception {
        AndroidLikeProcess p=new AndroidLikeProcess();p.alive=false;
        NativeProcessLifecycle.stop(p,(child,force)->fail("Must not signal a reaped PID"),0,0);assertTrue(p.closed);
        NativeProcessLifecycle.stop(null,(child,force)->fail(),0,0);
    }
    @Test public void usesPlatformPidWithoutHiddenApiReflection()throws Exception {
        assertEquals(123,NativeProcessLifecycle.pid(new AndroidLikeProcess()));
        Process p=new ProcessBuilder("sh","-c","exit 0").start();assertTrue(NativeProcessLifecycle.pid(p)>0);p.waitFor();
    }
    @Test public void actuallyStopsTermIgnoringChildOnHost()throws Exception {
        Process p=new ProcessBuilder("sh","-c","trap '' TERM; echo ready; exec sleep 60").start();
        try{
            assertEquals("ready",new BufferedReader(new InputStreamReader(p.getInputStream())).readLine());
            NativeProcessLifecycle.stop(p,(child,force)->{
                Process signal=new ProcessBuilder("kill",force?"-KILL":"-TERM",Integer.toString(NativeProcessLifecycle.pid(child))).start();assertEquals(0,signal.waitFor());
            },50,2000);
            assertFalse(p.isAlive());assertNotEquals(0,p.exitValue());
        }finally{p.destroyForcibly();}
    }
}
