package com.kalendarz.offline;

import android.net.Uri;
import android.util.Base64;
import android.webkit.WebResourceResponse;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.*;

/** One pinned llama.cpp process, shared by all Vulkan-capable Android vendors.
 * It is bound to loopback with an ephemeral API key, never exposed to the WebView.
 * No command, library path or model path is accepted from JavaScript.
 */
@CapacitorPlugin(name="CalendarNativeAI")
public class CalendarNativeAIPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicLong epoch=new AtomicLong();
    private volatile Process process, probeProcess;
    private volatile HttpURLConnection connection;
    private String mode="auto", loadedId, key, endpoint, log="", fallback, lastError;
    private boolean gpu, confirmed;
    private volatile int layers;
    private double loadMs;
    private Double speed;
    private String gpuName;
    private final Set<String> verified=new HashSet<>();
    private Upload upload;
    private interface Task { JSObject run() throws Exception; }
    private void submit(PluginCall call,Task task) {
        worker.execute(()->{try{call.resolve(task.run());}catch(Exception e){String code=e.getMessage();if(code==null||!code.startsWith("model-"))code="model-native-load";lastError=code;call.reject(code,e);}});
    }
    private File directory(){File dir=new File(getContext().getFilesDir(),"calendar-native-models");dir.mkdirs();return dir;}
    private JSONObject descriptor(PluginCall call)throws Exception {
        JSONObject m=call.getObject("model");
        if(m==null||!m.getString("id").matches("[a-z0-9-]{1,90}")||!m.getString("sha256").matches("[a-f0-9]{64}")||m.getLong("bytes")<24||m.getLong("bytes")>16L*1024*1024*1024||m.getInt("maxContext")<1||m.getInt("maxContext")>2048||m.optBoolean("external"))throw new Exception("model-input");
        return m;
    }
    private File file(JSONObject m)throws Exception{return new File(directory(),m.getString("id")+".gguf");}
    private String cacheKey(File f,JSONObject m)throws Exception{return f.getName()+":"+f.length()+":"+f.lastModified()+":"+m.getString("sha256");}
    private void verify(File f,JSONObject m,long version)throws Exception {
        if(!f.isFile()||f.length()!=m.getLong("bytes"))throw new Exception("model-size");
        String cache=cacheKey(f,m);if(verified.contains(cache))return;
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(f)) {byte[] b=new byte[1024*1024];int n;while((n=in.read(b))!=-1){check(version);hash.update(b,0,n);}}
        if(!hex(hash.digest()).equals(m.getString("sha256")))throw new Exception("model-checksum");
        try(DataInputStream in=new DataInputStream(new FileInputStream(f))){if(in.readInt()!=0x47475546)throw new Exception("model-gguf-invalid");}
        verified.add(cache);
    }
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}
    private void check(long version)throws Exception{if(epoch.get()!=version)throw new Exception("model-cancelled");}
    private File binary(){return new File(getContext().getApplicationInfo().nativeLibraryDir,"libcalendar_llama.so");}
    private JSObject snapshot(){
        JSObject s=new JSObject();s.put("mode",mode);s.put("backend",gpu?"vulkan":"cpu-native");s.put("available",binary().isFile()&&android.os.Build.VERSION.SDK_INT>=28);s.put("loaded",process!=null&&process.isAlive()&&loadedId!=null);s.put("gpuActive",confirmed&&process!=null&&process.isAlive()&&loadedId!=null);s.put("offloadedLayers",layers);s.put("threads",Math.min(4,Runtime.getRuntime().availableProcessors()));s.put("loadMs",loadMs);
        if(loadedId!=null)s.put("modelId",loadedId);if(gpuName!=null)s.put("deviceName",gpuName);if(fallback!=null)s.put("fallbackReason",fallback);if(lastError!=null)s.put("errorCode",lastError);if(speed!=null)s.put("tokensPerSecond",speed);
        // Android does not provide portable per-process VRAM counters. Never invent them.
        try{if(process!=null){for(String line:Files.readAllLines(Paths.get("/proc/"+((Number)process.getClass().getMethod("pid").invoke(process)).longValue()+"/status")))if(line.startsWith("VmRSS:")){s.put("ramBytes",Long.parseLong(line.replaceAll("[^0-9]",""))*1024);s.put("memoryScope","native-server resident memory");}}}catch(Exception ignored){}
        for(android.content.pm.FeatureInfo feature:getContext().getPackageManager().getSystemAvailableFeatures()){
            if("android.hardware.vulkan.version".equals(feature.name))s.put("vulkanFeatureVersion",feature.version);
            if("android.hardware.vulkan.level".equals(feature.name))s.put("vulkanHardwareLevel",feature.version);
        }
        return s;
    }
    @PluginMethod public void status(PluginCall call){submit(call,()->snapshot());}
    @PluginMethod public void info(PluginCall call){submit(call,()->{JSONObject m=descriptor(call);File f=file(m);JSObject out=new JSObject();out.put("installed",f.isFile()&&f.length()==m.getLong("bytes"));out.put("bytes",f.isFile()?f.length():0);return out;});}
    private static class Upload {String token;JSONObject model;File part;FileOutputStream stream;long bytes;}
    @PluginMethod public void begin(PluginCall call){submit(call,()->{
        if(upload!=null)throw new Exception("model-busy");JSONObject m=descriptor(call);File f=file(m);JSObject out=new JSObject();
        if(f.isFile()){try{verify(f,m,epoch.get());out.put("exists",true);return out;}catch(Exception e){if(!Arrays.asList("model-size","model-checksum").contains(e.getMessage()))throw e;}}
        if(directory().getUsableSpace()<m.getLong("bytes")+64L*1024*1024)throw new Exception("model-storage-space");
        Upload u=new Upload();u.token=UUID.randomUUID().toString();u.model=m;u.part=new File(directory(),u.token+".partial");u.stream=new FileOutputStream(u.part);upload=u;out.put("token",u.token);return out;
    });}
    private Upload upload(PluginCall call)throws Exception{if(upload==null||!upload.token.equals(call.getString("token")))throw new Exception("model-upload");return upload;}
    @PluginMethod public void write(PluginCall call){submit(call,()->{Upload u=upload(call);String encoded=call.getString("data","");if(encoded.length()>400000)throw new Exception("model-input");byte[] data=Base64.decode(encoded,Base64.NO_WRAP);if(u.bytes+data.length>u.model.getLong("bytes"))throw new Exception("model-size");u.stream.write(data);u.bytes+=data.length;JSObject out=new JSObject();out.put("bytes",u.bytes);return out;});}
    @PluginMethod public void finish(PluginCall call){submit(call,()->{Upload u=upload(call);u.stream.getFD().sync();u.stream.close();verify(u.part,u.model,epoch.get());Files.move(u.part.toPath(),file(u.model).toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);upload=null;JSObject out=new JSObject();out.put("installed",true);return out;});}
    @PluginMethod public void abortUpload(PluginCall call){submit(call,()->{if(upload!=null&&upload.token.equals(call.getString("token"))){upload.stream.close();upload.part.delete();upload=null;}return new JSObject();});}
    @PluginMethod public void remove(PluginCall call){submit(call,()->{JSONObject m=descriptor(call);if(m.getString("id").equals(loadedId))stopProcess();Files.deleteIfExists(file(m).toPath());verified.clear();return new JSObject();});}
    private void interrupt(){epoch.incrementAndGet();HttpURLConnection c=connection;if(c!=null)c.disconnect();Process p=process;if(p!=null)p.destroy();p=probeProcess;if(p!=null)p.destroy();}
    private void kill(Process p)throws Exception{if(p==null)return;p.destroy();if(!p.waitFor(1500,TimeUnit.MILLISECONDS)){p.destroyForcibly();if(!p.waitFor(3500,TimeUnit.MILLISECONDS))throw new Exception("model-stop-timeout");}}
    private void stopProcess()throws Exception{Process p=process;process=null;loadedId=null;confirmed=false;layers=0;gpu=false;speed=null;kill(p);}
    @PluginMethod public void stop(PluginCall call){interrupt();submit(call,()->{stopProcess();return new JSObject();});}
    @PluginMethod public void setMode(PluginCall call){String next=call.getString("mode","");if(!Arrays.asList("auto","gpu","cpu").contains(next)){call.reject("model-input");return;}interrupt();submit(call,()->{stopProcess();mode=next;fallback=null;lastError=null;return snapshot();});}
    private Process spawn(List<String> args)throws Exception{
        List<String> command=new ArrayList<>();command.add(binary().getAbsolutePath());command.addAll(args);
        ProcessBuilder b=new ProcessBuilder(command).redirectErrorStream(true);b.environment().put("LD_LIBRARY_PATH",binary().getParent());return b.start();
    }
    private String probe(long version)throws Exception{
        Process p=spawn(Arrays.asList("--list-devices"));probeProcess=p;StringBuilder output=new StringBuilder();
        Thread reader=new Thread(()->{try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){String line;while((line=r.readLine())!=null){synchronized(output){if(output.length()<32000)output.append(line).append('\n');}}}catch(IOException ignored){}});reader.start();
        try{if(!p.waitFor(10,TimeUnit.SECONDS))throw new Exception("model-gpu-probe");reader.join(1000);check(version);if(p.exitValue()!=0)throw new Exception("model-gpu-driver");synchronized(output){return output.toString();}}
        finally{kill(p);probeProcess=null;}
    }
    private JSONObject request(String path,JSONObject body,int timeout)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(endpoint+path).openConnection();connection=c;c.setConnectTimeout(1500);c.setReadTimeout(timeout);c.setRequestProperty("Authorization","Bearer "+key);
        try{if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}}
            if(c.getResponseCode()!=200)throw new Exception("model-native-response");
            try(InputStream in=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>512000)throw new Exception("model-response");out.write(b,0,n);}return new JSONObject(out.toString("UTF-8"));}
        }finally{c.disconnect();if(connection==c)connection=null;}
    }
    private void start(JSONObject m,String device,long version)throws Exception{
        stopProcess();check(version);if(!binary().isFile())throw new Exception("model-native-unavailable");
        File f=file(m);
        if(!f.isFile()&&m.optBoolean("bundled")){
            String name=m.getString("file");if(!name.matches("[a-zA-Z0-9._-]+"))throw new Exception("model-input");
            File part=new File(directory(),m.getString("id")+".bundled.partial");
            try(InputStream in=getContext().getAssets().open("public/models/"+name);FileOutputStream out=new FileOutputStream(part)){
                byte[] b=new byte[1024*1024];int n;long copied=0;while((n=in.read(b))!=-1){check(version);copied+=n;if(copied>m.getLong("bytes"))throw new Exception("model-size");out.write(b,0,n);}out.getFD().sync();
            }catch(Exception e){part.delete();throw e;}
            try{verify(part,m,version);Files.move(part.toPath(),f.toPath(),StandardCopyOption.ATOMIC_MOVE);}finally{part.delete();}
        }
        verify(f,m,version);int port;try(ServerSocket socket=new ServerSocket(0,0,InetAddress.getByName("127.0.0.1"))){port=socket.getLocalPort();}
        key=UUID.randomUUID().toString()+UUID.randomUUID();endpoint="http://127.0.0.1:"+port;log="";layers=0;
        long started=System.nanoTime();
        List<String> args=Arrays.asList("--host","127.0.0.1","--port",Integer.toString(port),"--api-key",key,"--model",f.getAbsolutePath(),"--ctx-size",Integer.toString(m.getInt("maxContext")),"--parallel","1","--threads",Integer.toString(Math.min(4,Runtime.getRuntime().availableProcessors())),"--batch-size","128","--ubatch-size","64","--no-webui","--n-gpu-layers",device==null?"0":"999","--device",device==null?"none":device,"--jinja");
        Process p=spawn(args);process=p;
        Thread reader=new Thread(()->{try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){String line;while((line=r.readLine())!=null){synchronized(this){log=(log+line+'\n');if(log.length()>32000)log=log.substring(log.length()-32000);Matcher match=Pattern.compile("offloaded (\\d+)/\\d+ layers to GPU").matcher(line);if(match.find())layers=Integer.parseInt(match.group(1));}}}catch(IOException ignored){}});reader.setDaemon(true);reader.start();
        try{long deadline=System.nanoTime()+120_000_000_000L;boolean ready=false;while(System.nanoTime()<deadline){check(version);if(!p.isAlive())throw new Exception("model-native-load");try{request("/health",null,1000);ready=true;break;}catch(Exception ignored){}check(version);Thread.sleep(100);}
            check(version);if(!ready)throw new Exception("model-timeout");if(device!=null&&layers<1)throw new Exception("model-gpu-offload");loadedId=m.getString("id");gpu=device!=null;confirmed=false;loadMs=(System.nanoTime()-started)/1e6;
        }catch(Exception e){String detail;synchronized(this){detail=log.toLowerCase(Locale.ROOT);}stopProcess();
            if(device==null&&!e.getMessage().equals("model-cancelled")){
                if(detail.contains("out of memory")||detail.contains("bad_alloc")||detail.contains("allocation failed"))throw new Exception("model-memory",e);
                if(detail.contains("unknown model architecture")||detail.contains("failed to load model")||detail.contains("invalid gguf"))throw new Exception("model-gguf-unsupported",e);
            }
            throw e;}
    }
    private void prepare(JSONObject m,long version)throws Exception{
        if(process!=null&&process.isAlive()&&m.getString("id").equals(loadedId))return;
        fallback=null;lastError=null;gpuName=null;
        if(!mode.equals("cpu")){
            try{
                String devices=probe(version);Matcher match=Pattern.compile("(?m)^\\s*(Vulkan\\d+):\\s*(.+)$").matcher(devices);String device=null;
                while(match.find()){if(!match.group(2).matches("(?i).*(llvmpipe|lavapipe|swiftshader|software|cpu).*")){device=match.group(1);gpuName=match.group(2);break;}}
                if(device==null)fallback="no-compatible-gpu";else{start(m,device,version);return;}
            }catch(Exception e){check(version);String detail; synchronized(this){detail=log.toLowerCase(Locale.ROOT);}fallback=detail.contains("out of device memory")||detail.contains("out of memory")?"insufficient-vram":"gpu-start-failed";stopProcess();}
            if(mode.equals("gpu")){lastError="model-gpu-unavailable";throw new Exception(lastError);}
        }
        start(m,null,version);
    }
    @PluginMethod public void prepare(PluginCall call){long version=epoch.get();submit(call,()->{try{prepare(descriptor(call),version);return snapshot();}catch(Exception e){stopProcess();throw e;}});}
    private JSONObject validateRequest(JSONObject input)throws Exception{
        if(input==null||input.toString().length()>60000)throw new Exception("model-input");
        JSONArray messages=input.getJSONArray("messages");int max=input.getInt("max_tokens"),length=0;if(messages.length()>7||max<1||max>768)throw new Exception("model-input");
        for(int i=0;i<messages.length();i++){JSONObject message=messages.getJSONObject(i);if(!Arrays.asList("user","assistant","system").contains(message.getString("role")))throw new Exception("model-input");length+=message.getString("content").length();}if(length>20000)throw new Exception("model-input");
        JSONObject out=new JSONObject();out.put("messages",messages);out.put("max_tokens",max);out.put("temperature",0);out.put("stream",true);out.put("stream_options",new JSONObject().put("include_usage",true));out.put("chat_template_kwargs",new JSONObject().put("enable_thinking",false));if(input.has("response_format"))out.put("response_format",input.get("response_format"));return out;
    }
    private JSObject complete(JSONObject request,long version)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(endpoint+"/v1/chat/completions").openConnection();connection=c;c.setConnectTimeout(1500);c.setReadTimeout(180000);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Authorization","Bearer "+key);c.setRequestProperty("Content-Type","application/json");
        StringBuilder text=new StringBuilder();JSONObject usage=new JSONObject(),timings=new JSONObject();String finish=null;Double first=null;long started=System.nanoTime();
        try{try(OutputStream out=c.getOutputStream()){out.write(request.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}if(c.getResponseCode()!=200)throw new Exception("model-native-response");
            try(BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream(),java.nio.charset.StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null){check(version);if(line.length()>512000)throw new Exception("model-response");if(!line.startsWith("data:")||line.equals("data: [DONE]"))continue;JSONObject chunk=new JSONObject(line.substring(5));JSONArray choices=chunk.optJSONArray("choices");if(choices!=null&&choices.length()>0){JSONObject choice=choices.getJSONObject(0),delta=choice.optJSONObject("delta");String content=delta==null?"":delta.optString("content","");if(!content.isEmpty()){if(first==null)first=(System.nanoTime()-started)/1e6;text.append(content);}if(!choice.isNull("finish_reason"))finish=choice.optString("finish_reason",null);}if(text.length()>24000)throw new Exception("model-response");if(!chunk.isNull("usage"))usage=chunk.getJSONObject("usage");if(!chunk.isNull("timings"))timings=chunk.getJSONObject("timings");}}
            if(text.length()==0||finish==null)throw new Exception("model-response");confirmed=gpu&&layers>0&&usage.optInt("completion_tokens",timings.optInt("predicted_n",0))>0;speed=timings.has("predicted_per_second")?timings.getDouble("predicted_per_second"):null;
            JSObject out=new JSObject();out.put("text",text.toString());out.put("finish",finish);out.put("usage",usage);out.put("timings",timings);if(first!=null)out.put("firstTokenMs",first);out.put("backend",snapshot());return out;
        }finally{c.disconnect();if(connection==c)connection=null;}
    }
    @PluginMethod public void complete(PluginCall call){long version=epoch.get();submit(call,()->{
        JSONObject m=descriptor(call),request=validateRequest(call.getObject("request"));
        try{prepare(m,version);check(version);try{return complete(request,version);}catch(Exception e){check(version);if(!gpu)throw e;stopProcess();fallback="gpu-inference-failed";if(mode.equals("gpu"))throw new Exception("model-gpu-inference");start(m,null,version);return complete(request,version);}}
        catch(Exception e){stopProcess();throw e;}
    });}
    static WebResourceResponse intercept(android.content.Context context,Uri url){
        if(!"https".equals(url.getScheme())||!"localhost".equals(url.getHost())||url.getPort()!=-1||!url.getPath().startsWith("/_calendar_native_model/"))return null;
        String id=url.getLastPathSegment();try{if(!id.matches("[a-z0-9-]{1,90}"))throw new IOException();File f=new File(new File(context.getFilesDir(),"calendar-native-models"),id+".gguf");return new WebResourceResponse("application/octet-stream",null,200,"OK",Collections.singletonMap("Cache-Control","no-store"),new FileInputStream(f));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(new byte[0]));}
    }
    @Override protected void handleOnDestroy(){interrupt();worker.execute(()->{try{stopProcess();if(upload!=null){upload.stream.close();upload.part.delete();upload=null;}}catch(Exception ignored){}});worker.shutdown();}
}
