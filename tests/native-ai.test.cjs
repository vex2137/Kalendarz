const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
const {NativeAI,parseDevices,validateRequest}=require('../electron/native-ai.cjs');

test('private model uploads verify bytes, reject paths and preserve files on failed replacement',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-native-store-'));
  const data=Buffer.from('verified weights'),sha256=createHash('sha256').update(data).digest('hex');
  const store=new NativeModelStore({root,bundledPath:path.join(root,'bundled.gguf'),bundledId:'bundled',catalogue:[{id:'optional',bytes:data.length,sha256},{id:'bundled',bytes:data.length,sha256}]});
  try{
    assert.throws(()=>store.file('../../elsewhere'),/model-unknown/);
    await assert.rejects(store.begin('bundled'),/model-bundled/);
    const {token}=await store.begin('optional');
    await assert.rejects(store.begin('optional'),/model-busy/);
    await store.write(token,data);await store.finish(token);
    assert.equal(await store.verifiedPath('optional'),store.file('optional'));
    assert.deepEqual(await store.begin('optional'),{exists:true});
    await fs.writeFile(store.file('optional'),Buffer.alloc(data.length));
    const bad=await store.begin('optional');await store.write(bad.token,Buffer.alloc(data.length,1));
    await assert.rejects(store.finish(bad.token),/model-checksum/);
    assert.deepEqual(await fs.readFile(store.file('optional')),Buffer.alloc(data.length),'Failed replacement must not delete the existing file');
    const short=await store.begin('optional');await store.write(short.token,data.subarray(0,2));await assert.rejects(store.finish(short.token),/model-size/);
    const cancelled=await store.begin('optional');await store.write(cancelled.token,data.subarray(0,2));await store.abort(cancelled.token);
    assert.deepEqual((await fs.readdir(root)).filter(name=>name.endsWith('.partial')),[]);
    const repair=await store.begin('optional');await store.write(repair.token,data);await store.finish(repair.token);await store.verifiedPath('optional');
    const controller=new AbortController();controller.abort();await assert.rejects(store.verifiedPath('optional',controller.signal),/abort/i);
  }finally{await store.close();await fs.rm(root,{recursive:true,force:true});}
});
test('software Vulkan devices do not count as GPUs; memory remains unknown when unreported',()=>{
  const devices=parseDevices('Available devices:\n Vulkan0: NVIDIA GeForce RTX 4060 (8188 MiB, 7000 MiB free)\n Vulkan1: llvmpipe (4096 MiB, 4000 MiB free)\n Vulkan2: AMD Radeon');
  assert.equal(devices.length,2);assert.equal(devices[0].freeBytes,7000*1048576);assert.equal(devices[1].totalBytes,undefined);
});
test('native request boundary rejects arbitrary server options and excessive histories',()=>{
  const request={messages:[{role:'user',content:'hello'}],max_tokens:32};
  assert.equal(validateRequest({...request,model:'/tmp/evil',tools:[{}]}).model,undefined);
  assert.throws(()=>validateRequest({...request,max_tokens:100000}),/model-input/);
  assert.throws(()=>validateRequest({...request,messages:Array(8).fill(request.messages[0])}),/model-input/);
  assert.throws(()=>validateRequest({...request,messages:[{role:'tool',content:'x'}]}),/model-input/);
});
// Fault injection checks control flow, not hardware support or GPU performance.
test('GPU generation failure retries the identical request once on CPU; cancellation does not retry',async()=>{
  const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({})}});
  ai.prepare=async()=>{ai.backend='vulkan';};ai.stop=async()=>{};
  const calls=[];ai.stream=async request=>{calls.push(request);if(ai.backend==='vulkan')throw Error('simulated device loss');return {text:'answer'};};
  ai.start=async(id,backend)=>{ai.backend=backend;};
  assert.equal((await ai.complete('known',{messages:[{role:'user',content:'Keep conversation'}],max_tokens:32})).text,'answer');
  assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(ai.snapshot().fallbackReason,'gpu-inference-failed');
  calls.length=0;ai.stream=async request=>{calls.push(request);ai.operation.abort();throw Error('cancelled');};
  await assert.rejects(ai.complete('known',{messages:[{role:'user',content:'Stop'}],max_tokens:32}),/cancelled/);assert.equal(calls.length,1);
});
