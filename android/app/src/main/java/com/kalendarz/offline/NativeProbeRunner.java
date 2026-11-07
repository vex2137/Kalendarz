package com.kalendarz.offline;

import org.json.JSONObject;
import java.io.*;
import java.util.concurrent.*;

/** Independent bounded process, never the inference process. No private model paths/logs. */
final class NativeProbeRunner {
    private volatile Process active;
    private volatile boolean cancelled;
    void cancel(){cancelled=true;Process p=active;if(p!=null)p.destroyForcibly();}
    static JSONObject failure(String stage,String code)throws Exception {
        return new JSONObject().put("version",1).put("success",false).put("stage",stage).put("errorCode",code);
    }
    private static byte[] read(InputStream in,int limit)throws IOException {
        try(InputStream input=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[2048];int n;while((n=input.read(b))!=-1){if(out.size()+n>limit)throw new IOException("probe-output-limit");out.write(b,0,n);}return out.toByteArray();
        }
    }
    JSONObject run(ProcessBuilder builder,long timeoutMs)throws Exception {
        if(active!=null&&active.isAlive())return failure("watchdog","vulkan-probe-still-running");
        if(cancelled)return failure("cancelled","vulkan-probe-cancelled");
        long start=System.nanoTime();ExecutorService readers=Executors.newFixedThreadPool(2,r->{Thread t=new Thread(r,"vulkan-probe-reader");t.setDaemon(true);return t;});
        Process child=null;
        try{
            child=builder.start();active=child;final Process process=child;
            Future<byte[]> stdout=readers.submit(()->read(process.getInputStream(),128*1024));
            Future<byte[]> stderr=readers.submit(()->read(process.getErrorStream(),4096));
            if(cancelled){child.destroyForcibly();return failure("cancelled","vulkan-probe-cancelled");}
            if(!child.waitFor(timeoutMs,TimeUnit.MILLISECONDS)){child.destroyForcibly();return failure("watchdog","vulkan-probe-timeout").put("timeoutMs",timeoutMs);}
            // Bound pipes too: a driver/child must not keep this worker waiting.
            String text=new String(stdout.get(500,TimeUnit.MILLISECONDS),java.nio.charset.StandardCharsets.UTF_8);
            stderr.get(500,TimeUnit.MILLISECONDS); // drained, never copied to app diagnostics
            JSONObject result=new JSONObject(text);
            if(result.optInt("version")!=1||!result.has("success")||!result.has("stage"))return failure("protocol","vulkan-probe-response");
            if(child.exitValue()!=0&&result.optBoolean("success"))return failure("process-exit","vulkan-probe-exit").put("exitCode",child.exitValue());
            result.put("exitCode",child.exitValue());result.put("processDurationMs",(System.nanoTime()-start)/1e6);return result;
        }catch(InterruptedException e){Thread.currentThread().interrupt();return failure("cancelled","vulkan-probe-cancelled");}
        catch(Exception e){return failure("process-response","vulkan-probe-response").put("exceptionType",e.getClass().getSimpleName());}
        finally{if(child!=null){child.destroyForcibly();if(!child.isAlive())active=null;}readers.shutdownNow();}
    }
}
