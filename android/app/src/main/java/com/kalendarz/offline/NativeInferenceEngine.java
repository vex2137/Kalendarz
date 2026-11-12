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
final class NativeInferenceEngine {
    private final android.content.Context context;
    private final java.util.function.BiConsumer<String,JSObject> events;
    private final java.util.function.BooleanSupplier bridgeAlive;
    NativeInferenceEngine(android.content.Context context,java.util.function.BiConsumer<String,JSObject> events,java.util.function.BooleanSupplier bridgeAlive){this.context=context.getApplicationContext();this.events=events;this.bridgeAlive=bridgeAlive;this.context.registerComponentCallbacks(new android.content.ComponentCallbacks2(){public void onConfigurationChanged(android.content.res.Configuration c){}public void onLowMemory(){pressure();}public void onTrimMemory(int level){if(level==TRIM_MEMORY_RUNNING_CRITICAL||level>=TRIM_MEMORY_BACKGROUND)pressure();}private void pressure(){interrupt();notifyListeners("memoryPressure",new JSObject());worker.execute(()->{try{stopProcess();}catch(Exception ignored){}});}});try{JSONObject saved=new JSONObject(context.getSharedPreferences("calendar-native-generation",0).getString("last","{}"));generationId=saved.optString("id",null);generationText=saved.optString("text","");generationState=saved.optString("status","cancelled");if("running".equals(generationState))generationState="cancelled";generationModel=saved.optString("modelId",null);generationStructured=saved.optBoolean("structured");}catch(Exception ignored){}}
    private android.content.Context getContext(){return context;}
    private void notifyListeners(String name,JSObject data){events.accept(name,data);}
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicLong epoch=new AtomicLong();
    private volatile Process process, probeProcess;
    private volatile HttpURLConnection connection;
    private volatile String mode="auto", loadedId, key, endpoint, log="", fallback, lastError;
    private volatile boolean gpu, confirmed;
    private volatile int layers;
    private int gpuLayerLimit=999;
    private boolean automaticLayers=true;
    private volatile boolean serviceRequested;
    private boolean vulkanDetected;
    private final Set<String> gpuFailures=new HashSet<>();
    private String modelName;
    private double loadMs;
    private Double speed;
    private final Map<String,Integer> contexts=new HashMap<>();
    private volatile Integer contextRequested,contextApplied,contextUsed;
    private volatile boolean completing, stopping;
    private volatile String shutdownError;
    private volatile JSObject inferenceEvidence;
    private final ScheduledExecutorService terminator=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"calendar-native-terminate");t.setDaemon(true);return t;});
    private final ExecutorService disconnects=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"calendar-native-disconnect");t.setDaemon(true);return t;});
    private final java.util.concurrent.atomic.AtomicBoolean completionRequest=new java.util.concurrent.atomic.AtomicBoolean();
    private volatile String generationId,generationText="",generationState="cancelled",generationModel;
    private volatile boolean generationStructured;
    private long generationCheckpoint;
    private volatile String backgroundProtection="disabled";
    private String gpuName;
    private NativeGpuDiagnostics gpuDiagnostics;
    private volatile boolean captureGpuStartup;
    private final Set<String> verified=new HashSet<>();
    private Upload upload;
    private android.os.ParcelFileDescriptor externalModelFd;
    private interface Task { JSObject run() throws Exception; }
    private void submit(PluginCall call,Task task) {
        worker.execute(()->{try{call.resolve(task.run());}catch(Exception e){String code=e.getMessage();if(code==null||!code.startsWith("model-"))code="model-native-load";lastError=code;call.reject(code,e);}});
    }
    private File directory(){File dir=new File(getContext().getFilesDir(),"calendar-native-models");dir.mkdirs();return dir;}
    private JSONObject descriptor(PluginCall call)throws Exception {
        JSONObject m=call.getObject("model");
        if(m!=null&&m.optBoolean("external"))return CalendarModelFoldersPlugin.store(getContext()).descriptor(m.getString("id"));
        if(m==null||!ModelIdentity.valid(m.getString("id"))||!m.getString("sha256").matches("[a-f0-9]{64}")||m.getLong("bytes")<24||m.getLong("bytes")>16L*1024*1024*1024||m.getInt("maxContext")<1||m.getInt("maxContext")>2048||m.optBoolean("external"))throw new Exception("model-input");
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
    private JSONObject runtimeManifest;
    private JSONObject runtimeManifest(){
        if(runtimeManifest==null){try(InputStream in=getContext().getAssets().open("android-native-runtime.json")){
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>65536)throw new IOException("Runtime manifest limit");out.write(b,0,n);}runtimeManifest=new JSONObject(out.toString("UTF-8"));
        }catch(Exception ignored){runtimeManifest=new JSONObject();}}
        return runtimeManifest;
    }
    private boolean hasVulkan(){JSONArray backends=runtimeManifest().optJSONArray("backends");if(backends==null)return false;for(int i=0;i<backends.length();i++)if("vulkan".equals(backends.optString(i)))return vulkanBinary().isFile()&&vulkanBinary().canExecute();return false;}
    private File vulkanBinary(){return runtimeManifest().has("vulkan")?new File(getContext().getApplicationInfo().nativeLibraryDir,"libcalendar_llama_vulkan.so"):binary();}
    private File binary(){return new File(getContext().getApplicationInfo().nativeLibraryDir,"libcalendar_llama.so");}
    private JSObject snapshot(){
        JSObject s=new JSObject();s.put("system","Android "+android.os.Build.VERSION.RELEASE);s.put("cpuArchitecture",android.os.Build.SUPPORTED_ABIS.length>0?android.os.Build.SUPPORTED_ABIS[0]:"unknown");s.put("gpuLayers",gpuLayerLimit);s.put("packagedBackends",new JSArray(binary().isFile()?(hasVulkan()?Arrays.asList("cpu-native","vulkan"):Arrays.asList("cpu-native")):Collections.emptyList()));s.put("availableBackends",new JSArray(vulkanDetected?Arrays.asList("vulkan"):Collections.emptyList()));s.put("mode",mode);s.put("backend",gpu?"vulkan":"cpu-native");s.put("available",binary().isFile()&&binary().canExecute()&&android.os.Build.VERSION.SDK_INT>=28);s.put("loaded",!stopping&&process!=null&&process.isAlive()&&loadedId!=null);s.put("gpuActive",!stopping&&confirmed&&process!=null&&process.isAlive()&&loadedId!=null);s.put("offloadedLayers",layers);s.put("threads",Math.min(4,Runtime.getRuntime().availableProcessors()));s.put("loadMs",loadMs);
        s.put("processAlive",process!=null&&process.isAlive());s.put("stopping",stopping);if(shutdownError!=null)s.put("shutdownError",shutdownError);if(inferenceEvidence!=null)s.put("inference",inferenceEvidence);
        s.put("automaticLayers",automaticLayers);s.put("contextLimit",NativeContextConfig.MAX_CONTEXT);
        android.app.ActivityManager manager=(android.app.ActivityManager)getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        if(manager!=null){android.app.ActivityManager.MemoryInfo memory=new android.app.ActivityManager.MemoryInfo();manager.getMemoryInfo(memory);s.put("availableMemoryBytes",memory.availMem);}
        if(contextRequested!=null)s.put("contextRequested",contextRequested);if(contextApplied!=null)s.put("contextApplied",contextApplied);if(contextUsed!=null)s.put("contextUsed",contextUsed);
        if(loadedId!=null){s.put("modelId",loadedId);if(modelName!=null)s.put("modelName",modelName);}if(gpuName!=null)s.put("deviceName",gpuName);if(fallback!=null)s.put("fallbackReason",fallback);if(lastError!=null)s.put("errorCode",lastError);if(speed!=null)s.put("tokensPerSecond",speed);
        if(gpuDiagnostics!=null)s.put("gpuAttempt",new JSONObject(gpuDiagnostics.snapshot()));
        s.put("nativeRuntime",new JSObject().put("version",runtimeManifest().optString("llamaVersion","unknown")).put("commit",runtimeManifest().optString("llamaCommit","unknown")).put("abi","arm64-v8a").put("vulkanLinkage",hasVulkan()?"static-backend/system-libvulkan":"not-packaged").put("binaryPresent",binary().isFile()).put("binaryExecutable",binary().canExecute()).put("supportedAbis",new JSArray(Arrays.asList(android.os.Build.SUPPORTED_ABIS))));
        s.put("backgroundProtection",CalendarInferenceService.running?"foreground-service":backgroundProtection);
        // Android does not provide portable per-process VRAM counters. Never invent them.
        try{if(process!=null){for(String line:Files.readAllLines(Paths.get("/proc/"+((Number)process.getClass().getMethod("pid").invoke(process)).longValue()+"/status")))if(line.startsWith("VmRSS:")){s.put("ramBytes",Long.parseLong(line.replaceAll("[^0-9]",""))*1024);s.put("memoryScope","native-server resident memory");}}}catch(Exception ignored){}
        for(android.content.pm.FeatureInfo feature:getContext().getPackageManager().getSystemAvailableFeatures()){
            if("android.hardware.vulkan.version".equals(feature.name))s.put("vulkanFeatureVersion",feature.version);
            if("android.hardware.vulkan.level".equals(feature.name))s.put("vulkanHardwareLevel",feature.version);
        }
        return s;
    }
    public void status(PluginCall call){call.resolve(snapshot());}
    public void info(PluginCall call){submit(call,()->{JSONObject m=descriptor(call);if(m.optBoolean("external"))return new JSObject(CalendarModelFoldersPlugin.store(getContext()).info(m.getString("id")).toString());File f=file(m);JSObject out=new JSObject();out.put("installed",false);out.put("verified",false);out.put("bytes",f.isFile()?f.length():0);if(f.isFile()){try{verify(f,m,epoch.get());out.put("installed",true);out.put("verified",true);}catch(Exception e){if(!Arrays.asList("model-size","model-checksum","model-gguf-invalid").contains(e.getMessage()))throw e;out.put("verificationError",e.getMessage());}}return out;});}
    private static class Upload {String token;JSONObject model;File part;FileOutputStream stream;long bytes;}
    public void begin(PluginCall call){submit(call,()->{
        if(upload!=null)throw new Exception("model-busy");JSONObject m=descriptor(call);File f=file(m);JSObject out=new JSObject();
        if(f.isFile()){try{verify(f,m,epoch.get());out.put("exists",true);return out;}catch(Exception e){if(!Arrays.asList("model-size","model-checksum").contains(e.getMessage()))throw e;}}
        if(directory().getUsableSpace()<m.getLong("bytes")+64L*1024*1024)throw new Exception("model-storage-space");
        Upload u=new Upload();u.token=UUID.randomUUID().toString();u.model=m;u.part=new File(directory(),u.token+".partial");u.stream=new FileOutputStream(u.part);upload=u;out.put("token",u.token);return out;
    });}
    private Upload upload(PluginCall call)throws Exception{if(upload==null||!upload.token.equals(call.getString("token")))throw new Exception("model-upload");return upload;}
    public void write(PluginCall call){submit(call,()->{Upload u=upload(call);String encoded=call.getString("data","");if(encoded.length()>400000)throw new Exception("model-input");byte[] data=Base64.decode(encoded,Base64.NO_WRAP);if(u.bytes+data.length>u.model.getLong("bytes"))throw new Exception("model-size");u.stream.write(data);u.bytes+=data.length;JSObject out=new JSObject();out.put("bytes",u.bytes);return out;});}
    public void finish(PluginCall call){submit(call,()->{Upload u=upload(call);u.stream.getFD().sync();u.stream.close();verify(u.part,u.model,epoch.get());Files.move(u.part.toPath(),file(u.model).toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);verified.add(cacheKey(file(u.model),u.model));upload=null;JSObject out=new JSObject();out.put("installed",true);return out;});}
    public void abortUpload(PluginCall call){submit(call,()->{if(upload!=null&&upload.token.equals(call.getString("token"))){upload.stream.close();upload.part.delete();upload=null;}return new JSObject();});}
    public void remove(PluginCall call){submit(call,()->{JSONObject m=descriptor(call);if(m.optBoolean("external"))throw new Exception("model-input");if(m.getString("id").equals(loadedId))stopProcess();Files.deleteIfExists(file(m).toPath());verified.clear();return new JSObject();});}
    private void disconnectRequest(){HttpURLConnection c=connection;if(c!=null)disconnects.execute(c::disconnect);}
    private void interruptGeneration(){if(completing&&getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("keepLoaded",false)){epoch.incrementAndGet();disconnectRequest();}else interrupt();}
    public void cancelGeneration(PluginCall call){interruptGeneration();call.resolve();}
    static void signalOwnedChild(Process p,boolean force)throws Exception{
        if(p==null||!p.isAlive())return;
        int pid=NativeProcessLifecycle.pid(p);
        // Restrict signalling to a still-owned direct child, including on a PID
        // reuse race. Never signal the Activity or arbitrary same-UID processes.
        String parent="PPid:\t"+android.os.Process.myPid();
        boolean owned=false;
        try{for(String line:Files.readAllLines(Paths.get("/proc/"+pid+"/status")))if(line.equals(parent)){owned=true;break;}}
        catch(java.nio.file.NoSuchFileException exited){if(p.waitFor(50,TimeUnit.MILLISECONDS))return;throw exited;}
        if(!owned){if(!p.isAlive())return;throw new IOException("model-stop-ownership");}
        try{android.system.Os.kill(pid,force?android.system.OsConstants.SIGKILL:android.system.OsConstants.SIGTERM);}
        catch(android.system.ErrnoException error){if(error.errno!=android.system.OsConstants.ESRCH)throw error;}
    }
    private void interruptChild(Process p){
        if(p==null)return;
        try{signalOwnedChild(p,false);}catch(Exception error){shutdownError="model-stop-signal";}
        // Escalate independently of the single inference worker: it may still be
        // blocked reading HTTP. Capturing p prevents killing a replacement child.
        terminator.schedule(()->{try{signalOwnedChild(p,true);}catch(Exception error){shutdownError="model-stop-signal";}},1500,TimeUnit.MILLISECONDS);
    }
    private void interrupt(){epoch.incrementAndGet();if(process!=null)stopping=true;interruptChild(process);interruptChild(probeProcess);disconnectRequest();}
    private void kill(Process p)throws Exception{NativeProcessLifecycle.stop(p,NativeInferenceEngine::signalOwnedChild,1500,3500);}
    private void stopProcess()throws Exception{
        Process p=process;captureGpuStartup=false;stopping=p!=null;
        try{kill(p);}catch(Exception error){shutdownError=error.getMessage()!=null&&error.getMessage().startsWith("model-")?error.getMessage():"model-stop-signal";throw error;}
        if(process==p)process=null;
        loadedId=null;confirmed=false;layers=0;gpu=false;speed=null;contextApplied=null;contextUsed=null;contextRequested=null;stopping=false;shutdownError=null;
        if("model-stop-timeout".equals(lastError))lastError=null;
        if(externalModelFd!=null){externalModelFd.close();externalModelFd=null;}
    }
    private void cleanupFailure(Exception original){try{stopProcess();}catch(Exception cleanup){original.addSuppressed(cleanup);}}
    public void stop(PluginCall call){interrupt();submit(call,()->{stopProcess();return new JSObject();});}
    public void setMode(PluginCall call){String next=call.getString("mode","");Integer limit=call.getInt("gpuLayers",999);if(!Arrays.asList("auto","gpu","cpu").contains(next)||limit==null||limit<1||limit>999){call.reject("model-input");return;}interrupt();submit(call,()->{stopProcess();gpuFailures.clear();mode=next;gpuLayerLimit=limit;automaticLayers=Boolean.TRUE.equals(call.getBoolean("automaticLayers",true));fallback=null;lastError=null;return snapshot();});}
    private Process spawn(List<String> args,boolean useGpu)throws Exception{
        return nativeProcessBuilder(useGpu?vulkanBinary():binary(),args).start();
    }
    // Shared by device packaging tests, so they exercise the production linker environment.
    static ProcessBuilder nativeProcessBuilder(File binary,List<String> args){
        List<String> command=new ArrayList<>();command.add(binary.getAbsolutePath());command.addAll(args);
        ProcessBuilder b=new ProcessBuilder(command).redirectErrorStream(true);b.environment().put("LD_LIBRARY_PATH",binary.getParent());return b;
    }
    private String probe(long version)throws Exception{
        Process p=spawn(Arrays.asList("--list-devices"),true);probeProcess=p;StringBuilder output=new StringBuilder();
        Thread reader=new Thread(()->{try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){String line;while((line=r.readLine())!=null){synchronized(output){if(output.length()<32000)output.append(line).append('\n');if(captureGpuStartup&&gpuDiagnostics!=null)gpuDiagnostics.line(line);}}}catch(IOException error){if(captureGpuStartup&&gpuDiagnostics!=null)gpuDiagnostics.line("error: native log read: "+error.getClass().getSimpleName()+": "+error.getMessage());}});reader.start();
        try{if(!p.waitFor(10,TimeUnit.SECONDS))throw new Exception("model-gpu-probe");reader.join(1000);check(version);if(p.exitValue()!=0)throw new Exception("model-gpu-driver");synchronized(output){return output.toString();}}
        finally{if(!p.isAlive()&&p.exitValue()!=0&&gpuDiagnostics!=null)gpuDiagnostics.fail(new Exception("model-gpu-driver"),p.exitValue());kill(p);probeProcess=null;}
    }
    private JSONObject request(String path,JSONObject body,int timeout)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(endpoint+path).openConnection();connection=c;c.setConnectTimeout(1500);c.setReadTimeout(timeout);c.setRequestProperty("Authorization","Bearer "+key);
        try{if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}}
            int responseCode=c.getResponseCode();if(path.equals("/health")&&captureGpuStartup&&gpuDiagnostics!=null)gpuDiagnostics.health(responseCode);if(responseCode!=200)throw new Exception("model-native-response");
            try(InputStream in=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>512000)throw new Exception("model-response");out.write(b,0,n);}return new JSONObject(out.toString("UTF-8"));}
        }finally{c.disconnect();if(connection==c)connection=null;}
    }
    private void start(JSONObject m,String device,long version)throws Exception{
        if(device!=null&&gpuDiagnostics!=null)gpuDiagnostics.stage("model-verification");
        stopProcess();check(version);if(!binary().isFile())throw new Exception("model-native-unavailable");
        File f;
        if(m.optBoolean("external")){externalModelFd=CalendarModelFoldersPlugin.store(getContext()).open(m.getString("id"));f=new File("/proc/"+android.os.Process.myPid()+"/fd/"+externalModelFd.getFd());}else f=file(m);
        if(!m.optBoolean("external")&&!f.isFile()&&m.optBoolean("bundled")){
            String name=m.getString("file");if(!name.matches("[a-zA-Z0-9._-]+"))throw new Exception("model-input");
            File part=new File(directory(),m.getString("id")+".bundled.partial");
            try(InputStream in=getContext().getAssets().open("public/models/"+name);FileOutputStream out=new FileOutputStream(part)){
                byte[] b=new byte[1024*1024];int n;long copied=0;while((n=in.read(b))!=-1){check(version);copied+=n;if(copied>m.getLong("bytes"))throw new Exception("model-size");out.write(b,0,n);}out.getFD().sync();
            }catch(Exception e){part.delete();throw e;}
            try{verify(part,m,version);Files.move(part.toPath(),f.toPath(),StandardCopyOption.ATOMIC_MOVE);verified.add(cacheKey(f,m));}finally{part.delete();}
        }
        if(!m.optBoolean("external"))verify(f,m,version);
        android.app.ActivityManager manager=(android.app.ActivityManager)getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        if(manager!=null){android.app.ActivityManager.MemoryInfo memory=new android.app.ActivityManager.MemoryInfo();manager.getMemoryInfo(memory);NativeContextConfig.requireMemory(memory.availMem,memory.lowMemory);}
        int port;try(ServerSocket socket=new ServerSocket(0,0,InetAddress.getByName("127.0.0.1"))){port=socket.getLocalPort();}
        key=UUID.randomUUID().toString()+UUID.randomUUID();endpoint="http://127.0.0.1:"+port;log="";layers=0;
        long started=System.nanoTime();
        List<String> args=Arrays.asList("--host","127.0.0.1","--port",Integer.toString(port),"--api-key",key,"--model",f.getAbsolutePath(),"--ctx-size",Integer.toString(contexts.containsKey(m.getString("id"))?contexts.get(m.getString("id")):m.getInt("maxContext")),"--parallel","1","--threads",Integer.toString(Math.min(4,Runtime.getRuntime().availableProcessors())),"--batch-size","128","--ubatch-size","64","--no-webui","--log-verbosity","4","--n-gpu-layers",device==null?"0":Integer.toString(gpuLayerLimit),"--device",device==null?"none":device,"--jinja");
        if(device!=null&&gpuDiagnostics!=null){gpuDiagnostics.launch(args);gpuDiagnostics.stage("process-start");}
        Process p=spawn(args,device!=null);process=p;stopping=false;captureGpuStartup=device!=null&&gpuDiagnostics!=null;
        NativeGpuDiagnostics startupTrace=device==null?null:gpuDiagnostics;
        if(device!=null&&gpuDiagnostics!=null)gpuDiagnostics.stage("native-startup");
        Thread reader=new Thread(()->{try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){String line;while((line=r.readLine())!=null){synchronized(this){if(process!=p)continue;log=(log+line+'\n');if(captureGpuStartup&&startupTrace!=null)startupTrace.line(line);if(log.length()>32000)log=log.substring(log.length()-32000);Matcher match=Pattern.compile("offloaded (\\d+)/\\d+ layers to GPU").matcher(line);if(match.find())layers=Integer.parseInt(match.group(1));}}}catch(IOException error){if(process==p&&!stopping&&p.isAlive()&&epoch.get()==version&&captureGpuStartup&&startupTrace!=null)startupTrace.line("error: native log read: "+error.getClass().getSimpleName()+": "+error.getMessage());}finally{if(startupTrace!=null)startupTrace.readerFinished();}});reader.setDaemon(true);reader.start();
        try{long deadline=System.nanoTime()+120_000_000_000L;boolean ready=false;while(System.nanoTime()<deadline){check(version);if(!p.isAlive())throw new Exception("model-native-load");try{request("/health",null,1000);ready=true;break;}catch(Exception ignored){}check(version);Thread.sleep(100);}
            check(version);if(!ready)throw new Exception("model-timeout");
            if(startupTrace!=null){layers=startupTrace.awaitOffload(1000);check(version);if(!p.isAlive())throw new Exception("model-native-load");if(layers<1)throw new Exception("model-gpu-offload");}
            contextRequested=contexts.containsKey(m.getString("id"))?contexts.get(m.getString("id")):m.getInt("maxContext");
            contextApplied=NativeContextConfig.fromLog(log);
            try{int actual=request("/props",null,1500).optJSONObject("default_generation_settings").optInt("n_ctx",0);if(actual>0)contextApplied=actual;}catch(Exception ignored){}
            loadedId=m.getString("id");modelName=m.optString("name",loadedId);gpu=device!=null;confirmed=false;loadMs=(System.nanoTime()-started)/1e6;if(startupTrace!=null)startupTrace.loaded(layers);
        }catch(Exception e){
            if(startupTrace!=null){if(!p.isAlive())reader.join(1000);boolean alive=p.isAlive();startupTrace.fail(e,alive?null:p.exitValue(),alive);}
            String detail;synchronized(this){detail=log.toLowerCase(Locale.ROOT);}cleanupFailure(e);
            if(device==null&&!e.getMessage().equals("model-cancelled")){
                if(detail.contains("out of memory")||detail.contains("bad_alloc")||detail.contains("allocation failed"))throw new Exception("model-memory",e);
                if(detail.contains("unknown model architecture")||detail.contains("failed to load model")||detail.contains("invalid gguf"))throw new Exception("model-gguf-unsupported",e);
            }
            throw e;}
    }
    private void prepare(JSONObject m,long version)throws Exception{
        check(version);if(!stopping&&process!=null&&process.isAlive()&&m.getString("id").equals(loadedId))return;
        fallback=null;lastError=null;gpuName=null;
        String failureKey=m.getString("id")+":"+contexts.get(m.getString("id"))+":"+gpuLayerLimit;
        if(mode.equals("gpu")&&gpuFailures.contains(failureKey))throw new Exception("model-gpu-unavailable");
        if(!mode.equals("cpu")&&hasVulkan()&&!gpuFailures.contains(failureKey)){
            gpuDiagnostics=new NativeGpuDiagnostics(gpuLayerLimit,contexts.containsKey(m.getString("id"))?contexts.get(m.getString("id")):m.getInt("maxContext"));captureGpuStartup=true;
            try{
                String devices=probe(version);Matcher match=Pattern.compile("(?m)^\\s*(Vulkan\\d+):\\s*(.+)$").matcher(devices);String device=null;
                while(match.find()){if(!match.group(2).matches("(?i).*(llvmpipe|lavapipe|swiftshader|software|cpu).*")){device=match.group(1);gpuName=match.group(2);break;}}
                vulkanDetected=device!=null;if(device==null){fallback="no-compatible-gpu";gpuDiagnostics.fail(new Exception("model-gpu-unavailable"),null);gpuFailures.add(failureKey);}else{gpuDiagnostics.selected(device);start(m,device,version);return;}
            }catch(Exception e){check(version);gpuDiagnostics.fail(e,process==null||process.isAlive()?null:process.exitValue());fallback=gpuDiagnostics.fallbackReason();gpuFailures.add(failureKey);try{stopProcess();}catch(Exception cleanup){e.addSuppressed(cleanup);throw e;}}
            // Keep the narrowly filtered capture through the first inference;
            // successful device enumeration/loading is not proof of GPU execution.
            finally{captureGpuStartup=gpu&&process!=null&&process.isAlive();}
            if(mode.equals("gpu")){lastError="model-gpu-unavailable";throw new Exception(lastError);}
        }
        if(mode.equals("gpu")&&!hasVulkan())throw new Exception("model-gpu-unavailable");
        start(m,null,version);
    }
    public void prepare(PluginCall call){
        if(completing){call.reject("model-busy");return;}
        final Integer requested;
        try{requested=call.getData().has("contextSize")&&!call.getData().isNull("contextSize")?NativeContextConfig.validate(call.getData().optDouble("contextSize",Double.NaN)):null;}catch(Exception error){call.reject("model-context-range");return;}
        long version=epoch.get();submit(call,()->{try{JSONObject m=descriptor(call);if(requested!=null){if(!requested.equals(contexts.get(m.getString("id")))&&loadedId!=null)stopProcess();contexts.put(m.getString("id"),requested);}prepare(m,version);return snapshot();}catch(Exception e){cleanupFailure(e);throw e;}});}
    static JSONObject validateRequest(JSONObject input)throws Exception{
        if(input==null||input.toString().length()>60000)throw new Exception("model-input");
        JSONArray messages=input.getJSONArray("messages");int max=NativeContextConfig.validateOutputTokens(input.getDouble("max_tokens")),length=0;if(messages.length()>7||max<1||max>4096)throw new Exception("model-input");
        for(int i=0;i<messages.length();i++){JSONObject message=messages.getJSONObject(i);if(!Arrays.asList("user","assistant","system").contains(message.getString("role")))throw new Exception("model-input");length+=message.getString("content").length();}if(length>20000)throw new Exception("model-input");
        JSONObject out=new JSONObject();out.put("messages",messages);out.put("max_tokens",max);out.put("temperature",0);out.put("top_k",50);out.put("repeat_penalty",1.05);out.put("stream",true);out.put("stream_options",new JSONObject().put("include_usage",true));out.put("chat_template_kwargs",new JSONObject().put("enable_thinking",false));if(input.has("response_format"))out.put("response_format",input.get("response_format"));return out;
    }
    public void generation(PluginCall call){call.resolve(generationSnapshot());}
    private JSObject generationSnapshot(){JSObject out=new JSObject();out.put("id",generationId);out.put("text",generationText);out.put("status",generationState);out.put("modelId",generationModel);out.put("structured",generationStructured);return out;}
    private void saveGeneration(){getContext().getSharedPreferences("calendar-native-generation",0).edit().putString("last",generationSnapshot().toString()).apply();}
    private void streamChunk(String id,String text,boolean reset){if(id==null)return;generationText=reset?"":generationText+text;if(System.currentTimeMillis()-generationCheckpoint>1500){generationCheckpoint=System.currentTimeMillis();saveGeneration();}JSObject data=new JSObject();data.put("requestId",id);data.put("text",text);data.put("reset",reset);notifyListeners("completionChunk",data);}
    private JSObject complete(JSONObject request,long version,String requestId)throws Exception{
        completing=true;
        HttpURLConnection c=(HttpURLConnection)new URL(endpoint+"/v1/chat/completions").openConnection();connection=c;c.setConnectTimeout(1500);c.setReadTimeout(180000);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Authorization","Bearer "+key);c.setRequestProperty("Content-Type","application/json");
        NativeCompletionText text=new NativeCompletionText();JSONObject usage=new JSONObject(),timings=new JSONObject();String finish=null;Double first=null;long started=System.nanoTime();
        inferenceEvidence=new JSObject().put("status","running").put("stage","request").put("backend",gpu?"vulkan":"cpu-native");
        if(gpu&&captureGpuStartup&&gpuDiagnostics!=null)gpuDiagnostics.stage("inference");
        try{try(OutputStream out=c.getOutputStream()){out.write(request.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}int http=c.getResponseCode();inferenceEvidence.put("httpStatus",http);if(http!=200)throw new Exception("model-native-response");inferenceEvidence.put("stage","stream");
            try(BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream(),java.nio.charset.StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null){check(version);if(line.length()>512000)throw new Exception("model-response");if(!line.startsWith("data:")||line.equals("data: [DONE]"))continue;JSONObject chunk=new JSONObject(line.substring(5));JSONArray choices=chunk.optJSONArray("choices");if(choices!=null&&choices.length()>0){JSONObject choice=choices.getJSONObject(0),delta=choice.optJSONObject("delta");if(text.append(delta)){if(text.length()>24000)throw new Exception("model-response");if(first==null)first=(System.nanoTime()-started)/1e6;streamChunk(requestId,(String)delta.opt("content"),false);}if(!choice.isNull("finish_reason"))finish=choice.optString("finish_reason",null);}if(text.length()>24000)throw new Exception("model-response");if(!chunk.isNull("usage"))usage=chunk.getJSONObject("usage");if(!chunk.isNull("timings"))timings=chunk.getJSONObject("timings");}}
            if(text.length()==0||finish==null)throw new Exception("model-response");confirmed=gpu&&layers>0&&usage.optInt("completion_tokens",timings.optInt("predicted_n",0))>0;speed=timings.has("predicted_per_second")?timings.getDouble("predicted_per_second"):null;if(confirmed&&gpuDiagnostics!=null){gpuDiagnostics.confirmed();captureGpuStartup=false;}
            inferenceEvidence.put("status","complete").put("stage","tokens-verified").put("completionTokens",usage.optInt("completion_tokens",timings.optInt("predicted_n",0))).put("textCharacters",text.length()).put("finishReason",finish);
            contextUsed=usage.has("prompt_tokens")&&usage.has("completion_tokens")?usage.getInt("prompt_tokens")+usage.getInt("completion_tokens"):null;
            JSObject out=new JSObject();out.put("text",text.toString());out.put("finish",finish);out.put("usage",usage);out.put("timings",timings);if(first!=null)out.put("firstTokenMs",first);out.put("backend",snapshot());return out;
        }catch(Exception error){inferenceEvidence.put("status",epoch.get()!=version?"cancelled":"failed").put("exceptionType",error.getClass().getSimpleName()).put("code",epoch.get()!=version?"model-cancelled":error.getMessage()!=null&&error.getMessage().matches("model-[a-z0-9-]+")?error.getMessage():"model-native-response");throw error;}
        finally{completing=false;c.disconnect();if(connection==c)connection=null;}
    }
    private synchronized void protectGeneration(boolean background){
        if(background&&completionRequest.get()&&!serviceRequested)try{CalendarInferenceService.begin(getContext(),this::interruptGeneration);serviceRequested=true;backgroundProtection="requested";}catch(RuntimeException error){backgroundProtection="unavailable";}
        if(!background&&serviceRequested){CalendarInferenceService.finish(getContext());serviceRequested=false;}
    }
    public void configureResidency(PluginCall call){
        boolean background=Boolean.TRUE.equals(call.getBoolean("background"));
        getContext().getSharedPreferences("calendar-ai-residency",0).edit().putBoolean("background",background).putBoolean("keepLoaded",Boolean.TRUE.equals(call.getBoolean("keepLoaded"))).apply();
        protectGeneration(background);call.resolve();
    }
    public void complete(PluginCall call){
        if(!completionRequest.compareAndSet(false,true)){call.reject("model-busy");return;}
        boolean background=getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("background",false);
        backgroundProtection=background?"requested":"disabled";
        protectGeneration(background);
        long version=epoch.get();submit(call,()->{boolean started=false;try{
        JSONObject m=descriptor(call),request=validateRequest(call.getObject("request"));String requestId=call.getString("requestId");if(requestId!=null&&!requestId.matches("[a-fA-F0-9-]{36}"))throw new Exception("model-input");generationId=requestId;generationText="";generationState="running";generationModel=m.getString("id");generationStructured=request.has("response_format");started=true;generationCheckpoint=0;saveGeneration();
        try{prepare(m,version);check(version);try{return complete(request,version,requestId);}catch(Exception e){check(version);if(!gpu)throw e;if(gpuDiagnostics!=null){if(!captureGpuStartup)gpuDiagnostics.stage("inference");gpuDiagnostics.fail(e,process==null||process.isAlive()?null:process.exitValue());}gpuFailures.add(m.getString("id")+":"+contexts.get(m.getString("id"))+":"+gpuLayerLimit);try{stopProcess();}catch(Exception cleanup){e.addSuppressed(cleanup);throw e;}fallback="gpu-inference-failed";if(mode.equals("gpu"))throw new Exception("model-gpu-inference");streamChunk(requestId,"",true);start(m,null,version);return complete(request,version,requestId);}}
        catch(Exception e){generationState="error";if(epoch.get()==version||!getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("keepLoaded",false)||process==null||!process.isAlive()||loadedId==null)cleanupFailure(e);throw e;}
        }finally{if(started){generationState=epoch.get()!=version?"cancelled":"error".equals(generationState)?"error":"complete";saveGeneration();}completionRequest.set(false);protectGeneration(false);if(!bridgeAlive.getAsBoolean()&&!getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("keepLoaded",false)){try{stopProcess();}catch(Exception cleanup){shutdownError=cleanup.getMessage();}}}
    });}
    static WebResourceResponse intercept(android.content.Context context,Uri url){
        if(!"https".equals(url.getScheme())||!"localhost".equals(url.getHost())||url.getPort()!=-1||!url.getPath().startsWith("/_calendar_native_model/"))return null;
        String id=url.getLastPathSegment();try{if(!ModelIdentity.valid(id))throw new IOException();File f=new File(new File(context.getFilesDir(),"calendar-native-models"),id+".gguf");return new WebResourceResponse("application/octet-stream",null,200,"OK",Collections.singletonMap("Cache-Control","no-store"),new FileInputStream(f));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(new byte[0]));}
    }
    void bridgeDestroyed(){
        boolean background=getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("background",false),keep=getContext().getSharedPreferences("calendar-ai-residency",0).getBoolean("keepLoaded",false);
        if(background&&completionRequest.get())return;
        if(!background&&completionRequest.get()){interruptGeneration();return;}
        if(!keep){interrupt();worker.execute(()->{try{stopProcess();if(upload!=null){upload.stream.close();upload.part.delete();upload=null;}}catch(Exception ignored){}});}
    }
}
