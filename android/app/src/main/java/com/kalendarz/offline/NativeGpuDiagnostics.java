package com.kalendarz.offline;

import java.util.*;
import java.util.regex.*;

/** Bounded startup-only evidence. Never accepts prompts, API keys or command lines. */
final class NativeGpuDiagnostics {
    private final long started=System.nanoTime();
    private final Deque<String> lines=new ArrayDeque<>();
    private final List<Map<String,Object>> stages=new ArrayList<>();
    private String stage="device-probe",status="initializing",code,nativeCode,errorType,message,device;
    private final int requestedLayers,context;
    private int logBytes,offloaded;
    private Integer exitCode,healthStatus;
    private final Map<String,String> arguments=new LinkedHashMap<>();
    NativeGpuDiagnostics(int layers,int context){this.requestedLayers=layers;this.context=context;stage("device-probe");}
    synchronized void stage(String next){
        if(status.equals("failed"))return;
        stage=next;
        if(stages.isEmpty()||!next.equals(stages.get(stages.size()-1).get("stage"))){
            if(stages.size()==20)stages.remove(0);
            Map<String,Object> event=new LinkedHashMap<>();event.put("stage",next);event.put("elapsedMs",elapsed());stages.add(event);
        }
    }
    synchronized void launch(List<String> args){
        Set<String> allowed=new HashSet<>(Arrays.asList("--device","--n-gpu-layers","--ctx-size","--threads","--batch-size","--ubatch-size"));
        for(int i=0;i+1<args.size();i++)if(allowed.contains(args.get(i)))arguments.put(args.get(i),sanitize(args.get(i+1)));
    }
    synchronized void selected(String id){device=id;stage("device-selection");}
    synchronized void health(int value){if(!status.equals("failed"))healthStatus=value;}
    synchronized void loaded(int layers){offloaded=layers;status="loaded";stage("loaded-awaiting-inference");}
    synchronized void confirmed(){status="confirmed";stage("inference-confirmed");}
    private double elapsed(){return (System.nanoTime()-started)/1e6;}
    static String sanitize(String input){
        if(input==null)return "";
        String s=input.replaceAll("\\x1B\\[[0-9;]*[A-Za-z]","");
        s=s.replaceAll("(?i)(bearer\\s+|api[-_]key[\\s:=]+|authorization[\\s:=]+)[^\\s,;]+","$1<redacted>");
        s=s.replaceAll("https?://[^\\s]+","<url>");
        s=s.replaceAll("(?<![A-Za-z0-9])/(?:[^\\s,;:]+)","<path>");
        return s.length()>1024?s.substring(0,1024):s;
    }
    synchronized void line(String raw){
        if(status.equals("failed")||status.equals("confirmed"))return;
        // Startup is the only capture window. Exclude metadata/chat templates and
        // ordinary server output, while retaining Vulkan/loader/exception evidence.
        String s=raw.replaceAll("\\x1B\\[[0-9;]*[A-Za-z]","").trim();
        if(s.contains("tokenizer.")||s.contains("chat_template"))return;
        String lower=s.toLowerCase(Locale.ROOT);
        Matcher layers=Pattern.compile("offloaded\\s+(\\d+)/(\\d+)\\s+layers to GPU").matcher(s);
        if(layers.find())offloaded=Integer.parseInt(layers.group(1));
        if(!(lower.startsWith("ggml_")||lower.startsWith("vulkan")||lower.startsWith("vk::")||lower.startsWith("error:")||lower.startsWith("libc++abi:")||s.contains("GGML_ASSERT")||s.contains("GGML_ABORT")||lower.startsWith("terminate")||lower.startsWith("what():")||lower.startsWith("cannot link executable")||lower.startsWith("llama_context:")||lower.startsWith("load_tensors:")||s.contains("VK_ERROR_")||lower.contains("offloaded ")))return;
        if(lower.contains("createcomputepipeline")||lower.contains("shader")&&lower.contains("fail"))stage("shader-pipeline-create");
        else if(lower.contains("createdevice")||lower.contains("required feature")||lower.contains("required extension"))stage("vulkan-device-create");
        else if(lower.startsWith("llama_context:"))stage("context-create");
        else if(lower.startsWith("load_tensors:"))stage("model-load-offload");
        s=sanitize(s);lines.add(s);logBytes+=s.length();
        while(lines.size()>64||logBytes>12000){logBytes-=lines.removeFirst().length();}
    }
    synchronized void fail(Throwable error,Integer processExit){
        if(status.equals("failed"))return;
        status="failed";code=error.getMessage()!=null&&error.getMessage().matches("model-[a-z0-9-]+")?error.getMessage():"model-native-load";
        errorType=error.getClass().getSimpleName();message=sanitize(error.getMessage());exitCode=processExit;
        String text=String.join("\n",lines)+"\n"+message;
        Matcher vk=Pattern.compile("VK_ERROR_[A-Z0-9_]+").matcher(text);while(vk.find())nativeCode=vk.group();
        if(nativeCode==null){Matcher hpp=Pattern.compile("\\bError[A-Z][A-Za-z]+\\b").matcher(text);while(hpp.find())nativeCode=hpp.group();}
    }
    synchronized String fallbackReason(){
        String text=(String.join("\n",lines)+" "+message).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");
        if(text.contains("outofdevicememory")||text.contains("outofhostmemory")||text.contains("outofmemory")||text.contains("badalloc")||text.contains("allocationfailed"))return "insufficient-vram";
        if(text.contains("vkerror")||text.contains("errorinitializationfailed")||text.contains("errorfeature")||text.contains("errorextension")||text.contains("errordevicelost")||text.contains("modelgpudriver"))return "gpu-driver-failed";
        return "gpu-start-failed";
    }
    synchronized Map<String,Object> snapshot(){
        Map<String,Object> s=new LinkedHashMap<>();s.put("stage",stage);s.put("status",status);s.put("arguments",new LinkedHashMap<>(arguments));s.put("requestedDevice",device);s.put("requestedLayers",requestedLayers);s.put("contextLength",context);s.put("offloadedLayersObserved",offloaded);s.put("code",code);s.put("nativeCode",nativeCode);s.put("exceptionType",errorType);s.put("message",message);s.put("exitCode",exitCode);s.put("healthHttpStatus",healthStatus);s.put("nativeLog",String.join("\n",lines));s.put("stages",new ArrayList<>(stages));return s;
    }
}
