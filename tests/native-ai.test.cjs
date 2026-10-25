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

test('CPU bypasses device probing; Auto handles absent GPUs and insufficient VRAM once',async()=>{
  for(const [mode,devices,reason] of [['cpu',[],undefined],['auto',[],'no-compatible-gpu'],['auto',[{id:'Vulkan0',freeBytes:1}],'insufficient-vram']]){
    const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({estimatedRamMB:100})}});ai.mode=mode;
    let probes=0;ai.probe=async()=>{probes++;return devices;};
    const backends=[];ai.start=async(id,backend)=>{backends.push(backend);return ai.snapshot();};
    await ai.prepare('known');assert.deepEqual(backends,['cpu']);assert.equal(probes,mode==='cpu'?0:1);assert.equal(ai.snapshot().fallbackReason,reason);
  }
});
test('Auto makes one CPU attempt after Vulkan initialization, memory, driver or runtime failure',async()=>{
  for(const log of ['GPU startup failed','VK_ERROR_OUT_OF_DEVICE_MEMORY','VK_ERROR_DEVICE_LOST']){
    const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({estimatedRamMB:100})}});
    ai.probe=async()=>[{id:'Vulkan0'}];const calls=[];
    ai.start=async(id,backend)=>{calls.push(backend);if(backend==='vulkan'){ai.log=log;throw Error('native-start-failed');}return ai.snapshot();};
    await ai.prepare('known');assert.deepEqual(calls,['vulkan','cpu']);
    assert.equal(ai.snapshot().fallbackReason,log.includes('MEMORY')?'insufficient-vram':log.includes('VK_ERROR')?'gpu-driver-failed':'gpu-start-failed');
  }
  const ai=new NativeAI({runtimeRoot:'/definitely-missing-runtime',store:{descriptor:()=>({})}});const calls=[];
  ai.start=async(id,backend)=>{calls.push(backend);throw Error('native-runtime-missing');};
  await assert.rejects(ai.prepare('known'),/native-runtime-missing/);assert.deepEqual(calls,['cpu']);assert.equal(ai.snapshot().fallbackReason,'gpu-runtime-unavailable');
});
test('explicit GPU mode reports failure and never starts CPU or retries generation there',async()=>{
  for(const devices of [[],[{id:'Vulkan0'}]]){
    const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({estimatedRamMB:100})}});ai.mode='gpu';ai.probe=async()=>devices;
    const calls=[];ai.start=async(id,backend)=>{calls.push(backend);throw Error('driver failure');};
    await assert.rejects(ai.prepare('known'),/model-gpu-unavailable/);assert.equal(calls.includes('cpu'),false);assert.equal(ai.snapshot().gpuActive,false);assert.equal(ai.snapshot().loaded,false);
  }
  const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({})}});ai.mode='gpu';ai.prepare=async()=>{ai.backend='vulkan';};
  ai.stream=async()=>{throw Error('device loss');};const calls=[];ai.start=async(id,backend)=>calls.push(backend);
  await assert.rejects(ai.complete('known',{messages:[{role:'user',content:'x'}],max_tokens:2}),/model-gpu-inference/);assert.deepEqual(calls,[]);assert.equal(ai.snapshot().gpuActive,false);
});
test('model switching cannot adopt another model\'s pending load',async()=>{
  const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({})}});ai.mode='cpu';
  let resolveLoad;ai.start=()=>new Promise(resolve=>{resolveLoad=resolve;});
  const first=ai.prepare('first');await assert.rejects(ai.prepare('second'),/model-busy/);
  const joined=ai.prepare('first');resolveLoad({loaded:true});assert.deepEqual(await first,await joined);
});
test('cancellation interrupts initialization without a CPU fallback and permits the next model',async()=>{
  const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({})}});ai.probe=async()=>[{id:'Vulkan0'}];
  const backends=[];let started;const ready=new Promise(resolve=>{started=resolve;});
  ai.start=async(id,backend,device,signal)=>{backends.push(backend);started();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));};
  const first=assert.rejects(ai.prepare('first'),/abort/i);await ready;await ai.cancel();await first;assert.deepEqual(backends,['vulkan']);
  ai.mode='cpu';ai.start=async()=>({loaded:true});assert.equal((await ai.prepare('second')).loaded,true);
});

test('content-addressed private imports reject paths and adopt verified bytes after restart',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-imported-store-'));
  const data=Buffer.from('GGUF synthetic storage fixture'),sha256=createHash('sha256').update(data).digest('hex');
  const d={id:'imported-'+sha256,sha256,bytes:data.length,name:'Local Qwen',architecture:'qwen35',maxContext:2048,imported:true,url:''};
  const store=new NativeModelStore({root,catalogue:[]});
  try{
    await assert.rejects(store.registerImported({...d,id:'../../outside'}),/model-input/);
    await store.registerImported(d);
    const {token}=await store.begin(d.id);await store.write(token,data);await store.finish(token);
    assert.equal(await store.verifiedPath(d.id),store.file(d.id));
    const restarted=new NativeModelStore({root,catalogue:[]});await restarted.registerImported(d);
    assert.equal((await restarted.info(d.id)).installed,true);
    await restarted.close();
  }finally{await store.close();await fs.rm(root,{recursive:true,force:true});}
});


test('CUDA and Metal device probes filter software devices and preserve backend identity',()=>{
  const devices=parseDevices(' CUDA0: NVIDIA RTX 4090 (24000 MiB, 22000 MiB free)\n Metal0: Apple M3\n Vulkan0: swiftshader');
  assert.deepEqual(devices.map(d=>[d.backend,d.id]),[['cuda','CUDA0'],['metal','Metal0']]);
});
test('Auto tries CUDA then Vulkan at most once before CPU; GPU-only never starts CPU',async()=>{
  for(const mode of ['auto','gpu']){
    const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({estimatedRamMB:100})}});ai.mode=mode;
    ai.probe=async()=>[{id:'CUDA0',backend:'cuda'},{id:'CUDA1',backend:'cuda'},{id:'Vulkan0',backend:'vulkan'}];
    const calls=[];ai.start=async(id,backend)=>{calls.push(backend);if(backend!=='cpu')throw Error('driver unavailable');return ai.snapshot();};
    if(mode==='auto')await ai.prepare('known');else await assert.rejects(ai.prepare('known'),/model-gpu-unavailable/);
    assert.deepEqual(calls,mode==='auto'?['cuda','vulkan','cpu']:['cuda','vulkan']);
  }
});
test('macOS Metal uses its verified native macOS archive and GPU mode selects Metal',async()=>{
  const ai=new NativeAI({runtimeRoot:'/runtime',platform:'darwin',store:{descriptor:()=>({estimatedRamMB:100})}});ai.mode='gpu';
  assert.equal(ai.binary('metal'),path.join('/runtime','cpu','llama-server'));
  ai.probe=async()=>[{id:'Metal0',backend:'metal',name:'Apple M3'}];const calls=[];
  ai.start=async(id,backend)=>{calls.push(backend);return ai.snapshot();};
  await ai.prepare('known');assert.deepEqual(calls,['metal']);
});


test('a GPU shutdown timeout prevents CPU startup',async()=>{
  const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({estimatedRamMB:100})}});
  ai.probe=async()=>[{id:'Vulkan0'}];const calls=[];
  ai.start=async(id,backend)=>{calls.push(backend);throw Error('model-stop-timeout');};
  await assert.rejects(ai.prepare('known'),/model-stop-timeout/);assert.deepEqual(calls,['vulkan']);
});
test('shutdown retains ownership of a live process after the termination deadline',async t=>{
  const {EventEmitter}=require('node:events');t.mock.timers.enable({apis:['setTimeout']});
  const child=new EventEmitter();child.exitCode=null;child.signalCode=null;const signals=[];child.kill=signal=>{signals.push(signal||'SIGTERM');return false;};
  const ai=new NativeAI({runtimeRoot:'/unused',store:{}});ai.child=child;
  const stopped=assert.rejects(ai.stop(),/model-stop-timeout/);t.mock.timers.tick(5000);await stopped;
  assert.equal(ai.child,child,'Keep the live handle so cleanup/retry cannot overlook it');
  assert.deepEqual(signals,['SIGTERM','SIGKILL']);child.exitCode=137;await ai.stop();assert.equal(ai.child,undefined);
});

test('GPU layer limits are validated and retained; changing mode clears an old failure',async()=>{
 const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({})}});ai.cancel=async()=>{};
 for(const value of [0,-1,1000,1.5,'8',NaN])await assert.rejects(ai.setMode('gpu',value),/model-input/);
 ai.state.errorCode='model-gpu-unavailable';await ai.setMode('gpu',8);
 assert.equal(ai.snapshot().gpuLayers,8);assert.equal(ai.snapshot().mode,'gpu');assert.equal(ai.snapshot().errorCode,undefined);
 ai.probe=async()=>[{backend:'vulkan',id:'Vulkan0',freeBytes:1}];let selected;
 ai.start=async(id,backend)=>{selected=backend;return ai.snapshot();};await ai.prepare('known');
 assert.equal(selected,'vulkan','Partial offload is measured by native allocation rather than rejected using full-model RAM');
});
