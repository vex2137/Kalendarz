package com.kalendarz.offline;

import static org.junit.Assert.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.Test;

/** Fault evidence tests only; never proof of an actual Vulkan-capable device. */
public class NativeGpuDiagnosticsTest {
    @Test public void parsesOffloadEvidenceWithAnsiAndFlexibleWhitespace(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(999,2048);
        trace.line("\u001B[32mload_tensors: offloaded\t8 / 25\tlayers to GPU\u001B[0m");
        assertEquals(8,trace.snapshot().get("offloadedLayersObserved"));assertEquals("positive",trace.snapshot().get("offloadEvidence"));
    }
    @Test public void readyServerWaitsForAsynchronousOffloadEvidence()throws Exception{
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(999,2048);trace.health(200);
        ExecutorService reader=Executors.newSingleThreadExecutor();
        try{
            Future<Integer> observed=reader.submit(()->trace.awaitOffload(1000));
            try{observed.get(20,TimeUnit.MILLISECONDS);fail("Health alone must not settle the offload check");}catch(TimeoutException expected){}
            trace.line("load_tensors: offloaded 25/25 layers to GPU");
            assertEquals(Integer.valueOf(25),observed.get(1,TimeUnit.SECONDS));
            assertEquals("initializing",trace.snapshot().get("status")); // Still no inference evidence.
        }finally{reader.shutdownNow();}
    }
    @Test public void distinguishesMissingLogFromExplicitZeroAndCapturesLiveProcess()throws Exception{
        NativeGpuDiagnostics missing=new NativeGpuDiagnostics(999,2048);missing.stage("native-startup");missing.health(200);
        assertEquals(0,missing.awaitOffload(0));missing.fail(new Exception("model-gpu-offload"),null,true);
        Map<String,Object> state=missing.snapshot();assertEquals("missing",state.get("offloadEvidence"));assertEquals(true,state.get("processAliveAtFailure"));assertNull(state.get("exitCode"));
        missing.readerFinished();assertEquals(state,missing.snapshot()); // Cleanup cannot rewrite failure-time evidence.
        NativeGpuDiagnostics zero=new NativeGpuDiagnostics(999,2048);zero.line("load_tensors: offloaded 0/25 layers to GPU");
        assertEquals(0,zero.awaitOffload(1000));assertEquals("zero",zero.snapshot().get("offloadEvidence"));
    }
    @Test public void readerEofEndsObservationWithoutClaimingOffload()throws Exception{
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(999,2048);trace.line("ggml_vulkan: VK_ERROR_DEVICE_LOST");trace.readerFinished();
        assertEquals(0,trace.awaitOffload(1000));trace.fail(new Exception("model-native-load"),134,false);
        assertEquals(true,trace.snapshot().get("startupReaderFinished"));assertEquals(false,trace.snapshot().get("processAliveAtFailure"));assertEquals(1,trace.snapshot().get("nativeLinesRead"));assertEquals("VK_ERROR_DEVICE_LOST",trace.snapshot().get("nativeCode"));
    }
    @Test public void retainsModelDeviceChoiceWithoutClaimingOffload(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(999,2048);
        trace.line("llama_model_load: using device Vulkan0 (Mali-G720 MC7) - 4096 MiB free");
        assertTrue(((String)trace.snapshot().get("nativeLog")).contains("using device Vulkan0"));assertEquals("missing",trace.snapshot().get("offloadEvidence"));
    }
    @Test public void capturesActualFailureStageAndRequestBeforeCleanup(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(999,2048);trace.selected("Vulkan0");trace.stage("process-start");
        trace.line("ggml_vulkan: vk::Device::createComputePipelines: ErrorInitializationFailed");trace.fail(new Exception("model-native-load"),134);
        Map<String,Object> state=trace.snapshot();assertEquals("failed",state.get("status"));assertEquals("shader-pipeline-create",state.get("stage"));
        assertEquals("ErrorInitializationFailed",state.get("nativeCode"));assertEquals(134,state.get("exitCode"));assertEquals(999,state.get("requestedLayers"));assertEquals("Vulkan0",state.get("requestedDevice"));assertEquals("gpu-driver-failed",trace.fallbackReason());
    }
    @Test public void classifiesBothVulkanAndHppMemoryFailures(){
        for(String value:Arrays.asList("VK_ERROR_OUT_OF_DEVICE_MEMORY","ErrorOutOfDeviceMemory","ErrorOutOfHostMemory")){
            NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.line("ggml_vulkan: allocation failed: "+value);trace.fail(new Exception("model-native-load"),1);assertEquals("insufficient-vram",trace.fallbackReason());assertEquals(value,trace.snapshot().get("nativeCode"));
        }
    }
    @Test public void fallbackCannotOverwriteStartupEvidence(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.stage("context-create");trace.health(503);trace.line("ggml_vulkan: VK_ERROR_DEVICE_LOST");trace.fail(new Exception("model-native-load"),1);
        Map<String,Object> before=trace.snapshot();trace.stage("cpu-load");trace.line("ggml_cpu: fallback works");trace.health(200);trace.fail(new Exception("model-inference"),143);assertEquals(before,trace.snapshot());
    }
    @Test public void doesNotCallEnumerationOrOffloadConfirmedInference(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.selected("Vulkan0");assertEquals("initializing",trace.snapshot().get("status"));trace.loaded(8);assertEquals("loaded",trace.snapshot().get("status"));trace.confirmed();assertEquals("confirmed",trace.snapshot().get("status"));
    }
    @Test public void logIsBoundedAndExcludesTemplatesAndOrdinaryServerOutput(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.line("srv request: PRIVATE MESSAGE VK_ERROR_DEVICE_LOST offloaded 1/2 layers to GPU");trace.line("ggml_metadata: tokenizer.chat_template PRIVATE TEMPLATE");
        for(int i=0;i<500;i++)trace.line("ggml_vulkan: device properties "+i+" "+String.join("",Collections.nCopies(200,"x")));
        String log=(String)trace.snapshot().get("nativeLog");assertTrue(log.length()<12100);assertFalse(log.contains("PRIVATE"));assertTrue(log.contains("499"));
    }
    @Test public void redactsPathsUrlsAndCredentialsButRetainsErrorCode(){
        String clean=NativeGpuDiagnostics.sanitize("error: /data/user/0/private/model.gguf api-key=secret bearer token https://host/file?signed=secret VK_ERROR_FEATURE_NOT_PRESENT");
        assertFalse(clean.contains("/data/"));assertFalse(clean.contains("secret"));assertFalse(clean.contains("bearer token"));assertTrue(clean.contains("VK_ERROR_FEATURE_NOT_PRESENT"));
    }
    @Test public void preservesObservedLayerCountAndHealthWithoutClaimingSuccess(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.line("load_tensors: offloaded 8/25 layers to GPU");trace.health(503);trace.fail(new Exception("model-timeout"),null);
        assertEquals(8,trace.snapshot().get("offloadedLayersObserved"));assertEquals(503,trace.snapshot().get("healthHttpStatus"));assertNull(trace.snapshot().get("exitCode"));assertEquals("failed",trace.snapshot().get("status"));
    }
    @Test public void recordsOnlySafeArgumentsActuallySentToTheProcess(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);
        trace.launch(Arrays.asList("--api-key","SECRET","--model","/private/model.gguf","--device","Vulkan0","--n-gpu-layers","8","--ctx-size","2048"));
        Map<?,?> args=(Map<?,?>)trace.snapshot().get("arguments");assertEquals("8",args.get("--n-gpu-layers"));assertEquals("Vulkan0",args.get("--device"));assertFalse(args.toString().contains("SECRET"));assertFalse(args.containsKey("--model"));
    }
    @Test public void nonVulkanStartupErrorRemainsSpecificAndSanitized(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(1,2048);trace.stage("process-start");trace.fail(new java.io.IOException("Cannot execute /private/path/libcalendar_llama.so"),null);
        assertEquals("IOException",trace.snapshot().get("exceptionType"));assertEquals("process-start",trace.snapshot().get("stage"));assertFalse(((String)trace.snapshot().get("message")).contains("/private"));
    }
    @Test public void capturesModelLoaderErrorsWithoutMetadataOrPaths(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.stage("native-startup");
        trace.line("llama_model_loader: loaded meta data from /private/model.gguf");
        trace.line("llama_model_load: error loading model: vk::Device::createComputePipelines: ErrorFeatureNotPresent /private/model.gguf");
        trace.line("common_init_from_params: failed to load model '/private/model.gguf'");
        trace.fail(new Exception("model-native-load"),1);
        assertEquals("shader-pipeline-create",trace.snapshot().get("stage"));
        assertEquals("ErrorFeatureNotPresent",trace.snapshot().get("nativeCode"));
        String log=(String)trace.snapshot().get("nativeLog");assertTrue(log.contains("failed to load model"));assertFalse(log.contains("/private"));assertFalse(log.contains("meta data"));
    }
    @Test public void distinguishesNativeLoaderFailureFromModelOrShaderFailure(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.stage("native-startup");
        trace.line("CANNOT LINK EXECUTABLE /data/app/private/libcalendar_llama.so: library libvulkan.so not found");
        trace.fail(new Exception("model-native-load"),1);
        assertEquals("native-loader",trace.snapshot().get("stage"));assertEquals("gpu-runtime-unavailable",trace.fallbackReason());
        assertTrue(((String)trace.snapshot().get("nativeLog")).contains("libvulkan.so"));
    }
    @Test public void firstInferenceFailureKeepsSpecificStageAndConfirmedTraceStopsCapture(){
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.loaded(8);trace.stage("inference");
        trace.line("ggml_vulkan: createComputePipelines failed: VK_ERROR_DEVICE_LOST");trace.fail(new Exception("model-native-response"),134);
        assertEquals("shader-pipeline-create",trace.snapshot().get("stage"));assertEquals("VK_ERROR_DEVICE_LOST",trace.snapshot().get("nativeCode"));
        NativeGpuDiagnostics confirmed=new NativeGpuDiagnostics(8,2048);confirmed.loaded(8);confirmed.confirmed();Map<String,Object> before=confirmed.snapshot();
        confirmed.line("ggml_vulkan: private later output");assertEquals(before,confirmed.snapshot());
    }
}
