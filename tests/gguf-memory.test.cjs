const test=require('node:test'),assert=require('node:assert/strict');
const {hybridKvLayout,hybridKvBytes}=require('../electron/gguf-memory.cjs');
const {gpuPlan}=require('../electron/gpu-plan.cjs');
const meta={'lfm3.embedding_length':2048,'lfm3.attention.head_count':16,'lfm3.attention.head_count_kv':[0,2,2,0],'lfm3.attention.sliding_window_pattern':[0,1,0,0],'lfm3.attention.sliding_window':1024,'lfm3.shortconv.l_cache':3};
test('LFM3 uses architecture-specific per-layer KV heads, SWA and recurrent state, not linear context extrapolation',()=>{
 const layout=hybridKvLayout('lfm3',meta,4);assert.ok(layout);assert.equal(layout[0].bytesPerToken,0);assert.equal(layout[1].window,1024);assert.equal(layout[2].window,undefined);
 const full=hybridKvBytes(layout,5,262144),partial=hybridKvBytes(layout,1,262144);
 assert.equal(full,1024*(1280+262144)+2*4*2048*2*64);assert.ok(partial<full);
 const plan=gpuPlan({blockCount:4,bytes:1500000000,kvLayout:layout},999,262144,{freeBytes:6.6*1024**3},true);
 assert.equal(plan.estimateKind,'hybrid-metadata');assert.equal(plan.rejected,false);assert.ok(plan.kvCacheBytes<1024**3);
});
test('missing/inconsistent GGUF dimensions keep explicit conservative fallback; low VRAM remains rejected',()=>{
 assert.equal(hybridKvLayout('qwen35',meta,4),undefined);
 for(const changes of [{'lfm3.attention.head_count_kv':[0,2]},{'lfm3.attention.sliding_window_pattern':undefined},{'lfm3.shortconv.l_cache':0}])assert.equal(hybridKvLayout('lfm3',{...meta,...changes},4),undefined);
 const model={blockCount:4,bytes:1500000000,kvLayout:hybridKvLayout('lfm3',meta,4)};
 assert.equal(gpuPlan(model,5,262144,{freeBytes:100*1048576},false).rejected,true);
});
