// Inject a failing GPU process; CPU inference still executes a real verified GGUF.
// This is process/fallback evidence, never evidence of physical GPU computation.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {NativeAI}=require('../electron/native-ai.cjs');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
(async()=>{
  assert.equal(process.platform,'linux','This process fault fixture is Linux-only');
  assert.ok(process.env.CALENDAR_MODEL_FILE,'Set a real 350M GGUF path');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-gpu-fault-'));
  const model=require('../src/utils/optionalModels.json')[0];
  const store=new NativeModelStore({root:path.join(root,'models'),catalogue:[model],bundledId:model.id,bundledPath:path.resolve(process.env.CALENDAR_MODEL_FILE)});
  const runtime=path.resolve('native/linux-x64'),manifest=JSON.parse(await fs.readFile(path.join(runtime,'runtime-manifest.json'),'utf8'));
  let ai;
  try{
    await fs.symlink(path.join(runtime,'cpu'),path.join(root,'cpu'),'dir');await fs.mkdir(path.join(root,'vulkan'));
    const marker=path.join(root,'gpu-pid');
    const source=`#!${process.execPath}\nconst fs=require('node:fs');if(process.argv.includes('--list-devices')){console.log('Vulkan0: Calendar injected fault device');process.exit(0);}process.on('SIGTERM',()=>{});process.stderr.write('VK_ERROR_OUT_OF_DEVICE_MEMORY\\n',()=>fs.writeFileSync(${JSON.stringify(marker)},String(process.pid)));setInterval(()=>{},1000);`;
    await fs.writeFile(path.join(root,'vulkan','llama-server'),source,{mode:0o755});
    const files=Object.fromEntries(Object.entries(manifest.files).filter(([key])=>key.startsWith('cpu/')));files['vulkan/llama-server']=crypto.createHash('sha256').update(source).digest('hex');
    await fs.writeFile(path.join(root,'runtime-manifest.json'),JSON.stringify({...manifest,files}));
    ai=new NativeAI({runtimeRoot:root,store});
    const beforeStart=ai.start.bind(ai),order=[];
    ai.start=async(id,backend,device,signal)=>{
      if(backend==='cpu'){
        const pid=Number(await fs.readFile(marker,'utf8'));
        assert.throws(()=>process.kill(pid,0),'The failed GPU process must exit BEFORE CPU startup');order.push('gpu-exited');
      }
      order.push(backend);
      // Abort GPU startup as a deterministic driver failure, without a 120s timeout.
      if(backend==='vulkan'){
        const local=new AbortController();const timer=setTimeout(()=>local.abort(),10000);
        const watch=setInterval(()=>{void fs.access(marker).then(()=>local.abort()).catch(()=>{});},50);
        try{return await beforeStart(id,backend,device,local.signal);}catch(error){assert.match(ai.log,/VK_ERROR_OUT_OF_DEVICE_MEMORY/);throw error;}finally{clearTimeout(timer);clearInterval(watch);}
      }
      return beforeStart(id,backend,device,signal);
    };
    const result=await ai.complete(model.id,{messages:[{role:'user',content:'Say hello.'}],max_tokens:16});
    assert.deepEqual(order,['vulkan','gpu-exited','cpu']);assert.equal(result.backend.backend,'cpu-native');assert.equal(result.backend.fallbackReason,'insufficient-vram');assert.equal(result.backend.gpuActive,false);assert.ok(result.usage.completion_tokens>0);
    await ai.cancel();assert.equal(ai.snapshot().loaded,false);
    console.log('PASS injected GPU memory failure: process killed before real CPU fallback, one retry, actual tokens, cancellation and cleanup');
    const bad=Buffer.from('invalid GGUF data'),badFile=path.join(root,'invalid.gguf');await fs.writeFile(badFile,bad);
    const badStore=new NativeModelStore({root:path.join(root,'private'),catalogue:[{...model,id:'invalid',bytes:bad.length,sha256:crypto.createHash('sha256').update(bad).digest('hex')}],bundledId:'invalid',bundledPath:badFile});
    const invalid=new NativeAI({runtimeRoot:runtime,store:badStore});
    try{await invalid.setMode('cpu');await assert.rejects(invalid.prepare('invalid'),/model-gguf-unsupported/);assert.equal(invalid.snapshot().loaded,false);assert.equal(invalid.child,undefined);}finally{await invalid.cancel();}
    console.log('PASS real native runtime rejects invalid GGUF with a clear error and no lingering process');
  }finally{await ai?.cancel();await store.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
