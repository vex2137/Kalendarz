package com.kalendarz.offline;

import static org.junit.Assert.*;
import java.util.*;
import org.junit.Test;

/** Fault evidence tests only; never proof of an actual Vulkan-capable device. */
public class NativeGpuDiagnosticsTest {
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
        NativeGpuDiagnostics trace=new NativeGpuDiagnostics(8,2048);trace.line("srv request: PRIVATE MESSAGE");trace.line("ggml_metadata: tokenizer.chat_template PRIVATE TEMPLATE");
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
}
