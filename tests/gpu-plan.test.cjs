const test=require('node:test'),assert=require('node:assert/strict');
const {layerLimit,gpuPlan,memoryEstimate,offloadEvidence}=require('../electron/gpu-plan.cjs');
const GiB=1024**3,MiB=1048576,model={architecture:'qwen35',bytes:4620000000,blockCount:32};
test('GPU limit includes output layer, clamps legacy 999 and does not invent missing blocks',()=>{
 assert.equal(layerLimit(model,999),33);assert.equal(layerLimit(model,5),5);
 for(const blockCount of [undefined,-1,0,NaN,'32'])assert.equal(layerLimit({...model,blockCount},999),1);
 assert.deepEqual(memoryEstimate(model,999,2048),memoryEstimate(model,33,2048));
});
test('Qwen 4B at 2048 fits 6.6 GiB without using the host RAM recommendation',()=>{
 const p=gpuPlan({...model,estimatedRamMB:14000},999,2048,{freeBytes:6.6*GiB},true);
 assert.equal(p.requestedLayers,33);assert.equal(p.effectiveLayers,33);assert.equal(p.rejected,false);
 assert.equal(p.estimatedVramBytes,model.bytes+640*MiB);assert.equal(p.reserveBytes,256*MiB);
 assert.equal(p.estimateKind,'approximate');assert.ok(p.estimatedVramBytes+p.reserveBytes<p.availableVramBytes);
});
test('Auto reduces offload within actual layer bounds and refuses configurations that cannot fit',()=>{
 const auto=gpuPlan(model,999,2048,{freeBytes:2*GiB},true);
 assert.ok(auto.effectiveLayers>0&&auto.effectiveLayers<33);assert.equal(auto.rejected,false);
 assert.equal(gpuPlan(model,33,2048,{freeBytes:2*GiB},false).rejected,true);
 assert.equal(gpuPlan(model,1,2048,{freeBytes:100*MiB},true).rejected,true);
 const unknown=gpuPlan({...model,blockCount:undefined},999,2048,{freeBytes:6.6*GiB},true);
 assert.equal(unknown.layerMetadataKnown,false);assert.equal(unknown.effectiveLayers,1);
 assert.equal(gpuPlan(model,999,2048,{},true).availableVramBytes,undefined);
});
test('context, KV metadata, partial offload, overhead and reserve contribute separately',()=>{
 const full=gpuPlan({...model,kvBytesPerToken:131072},33,2048,{freeBytes:8*GiB},false);
 const partial=gpuPlan({...model,kvBytesPerToken:131072},5,2048,{freeBytes:8*GiB},false);
 assert.equal(full.kvCacheBytes,256*MiB);assert.ok(partial.estimatedVramBytes<full.estimatedVramBytes);
 assert.equal(full.estimateKind,'metadata');assert.equal(full.backendOverheadBytes,384*MiB);
 assert.ok(gpuPlan(model,33,32768,{freeBytes:8*GiB},false).estimatedVramBytes>full.estimatedVramBytes);
});
test('offload parser accepts prefixed/spaced reports and distinguishes explicit zero from absent evidence',()=>{
 assert.deepEqual(offloadEvidence('0.1.123 I load_tensors: offloaded 5/33 layers to GPU\n'),{layers:5,total:33});
 assert.deepEqual(offloadEvidence('load_tensors: offloaded   5 / 33 layers to GPU'),{layers:5,total:33});
 assert.deepEqual(offloadEvidence('offloaded 0/33 layers to GPU'),{layers:0,total:33});
 for(const text of ['HTTP 200','CUDA0 model buffer size = 500 MiB','offloading 5 repeating layers to GPU','offloaded 34/33 layers to GPU'])assert.equal(offloadEvidence(text),undefined);
});
test('native preflight uses verified GGUF metadata rather than stale catalogue RAM or layer hints',async()=>{
 const {NativeAI}=require('../electron/native-ai.cjs');
 const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({maxContext:2048,estimatedRamMB:14000}),metadata:async()=>model}});
 ai.probe=async()=>[{backend:'cuda',id:'CUDA0',freeBytes:6.6*GiB}];
 ai.start=async(id,backend,device)=>{assert.equal(backend,'cuda');assert.equal(device.plan.effectiveLayers,33);return {loaded:true};};
 assert.equal((await ai.prepare('model',2048)).loaded,true);
});
