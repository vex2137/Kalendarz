package com.kalendarz.offline;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Android UNIXProcess inherits Process.destroyForcibly(), which calls destroy()
 * again. Use explicit signals, keep draining output, and confirm exit before
 * releasing the model descriptor. Never accept a PID from the JavaScript bridge. */
final class NativeProcessLifecycle {
    interface Signals { void send(Process process, boolean force) throws Exception; }
    static int pid(Process process) throws IOException {
        // Android's public Process API has no pid(). UNIXProcess exposes its PID
        // in this platform-owned string (libcore), without hidden API reflection.
        Matcher match=Pattern.compile("^Process\\[pid=(\\d+)(?:[, \\]])").matcher(process.toString());
        if(!match.find())throw new IOException("model-stop-pid");
        try {int pid=Integer.parseInt(match.group(1));if(pid>0)return pid;}catch(NumberFormatException ignored){}
        throw new IOException("model-stop-pid");
    }
    static void stop(Process process, Signals signals, long graceMs, long forceMs) throws Exception {
        if(process==null)return;
        if(process.isAlive()) {
            signals.send(process,false);
            if(!process.waitFor(graceMs,TimeUnit.MILLISECONDS)) {
                signals.send(process,true);
                if(!process.waitFor(forceMs,TimeUnit.MILLISECONDS))throw new IOException("model-stop-timeout");
            }
        }
        // destroy() closes these before termination on Android, interrupting the
        // log reader. Close only after the child has actually exited.
        try{process.getOutputStream().close();}catch(IOException ignored){}
        try{process.getInputStream().close();}catch(IOException ignored){}
        try{process.getErrorStream().close();}catch(IOException ignored){}
    }
}
