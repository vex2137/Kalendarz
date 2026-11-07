// Local fake processes exercise the native boundary. No NVIDIA/inference claim.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {NativeAI}=require('../electron/native-ai.cjs');
const {classifyLoadFailure,safeStartupLine}=require('../electron/native-startup.cjs');
const request={messages:[{role:'user',content:'private conversation'}],max_tokens:8};
async function fixture(body,fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-startup-')),binary=path.join(root,'llama-server');
 await fs.writeFile(binary,'#!/usr/bin/env node\n'+body,{mode:0o755});
 const ai=new NativeAI({runtimeRoot:root,store:{descriptor:()=>({name:'fixture',maxContext:2048,estimatedRamMB:100}),verifiedPath:async()=>'/private/user/model.gguf'}});
 for(const backend of ['cpu','cuda','vulkan']){await fs.mkdir(path.join(root,backend));await fs.copyFile(binary,path.join(root,backend,'llama-server'));}
 ai.verifyRuntime=async()=>{};ai.env=()=>process.env;ai.memory=async()=>{};
 try{await fn(ai);}finally{await ai.cancel();await fs.rm(root,{recursive:true,force:true});}
}
const healthy=`const http=require('node:http');const args=process.argv.slice(2);const get=n=>args[args.indexOf(n)+1];
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/props'?{default_generation_settings:{n_ctx:Number(get('--ctx-size'))}}:{status:'ok'}));}).listen(Number(get('--port')),'127.0.0.1');`;
test('health can precede stderr offload evidence; do not kill a healthy GPU process',{skip:process.platform==='win32'},()=>fixture(healthy+`\nsetTimeout(()=>console.error('offloaded 5/41 layers to GPU'),250);`,async ai=>{
 ai.mode='gpu';ai.gpuLayers=5;
 const state=await ai.start('same','cuda',{id:'CUDA0',name:'RTX fixture'},new AbortController().signal);
 assert.equal(state.loaded,true);assert.equal(state.offloadedLayers,5);assert.equal(state.gpuActive,false);
}));
test('a transient file-open load failure is not an unsupported model',{skip:process.platform==='win32'},()=>fixture(`console.error("error: failed to load model '/private/user/model.gguf': Permission denied");process.exitCode=7;`,async ai=>{
 await assert.rejects(ai.start('same','cpu',undefined,new AbortController().signal),/model-file-unavailable/);
}));
test('compatible explicit prepare and chat share one initialization',async()=>{
 const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({maxContext:2048})}});ai.mode='cpu';
 let finish,calls=0;ai.start=()=>{calls++;return new Promise(resolve=>finish=resolve);};ai.stream=async()=>({text:'answer'});
 const first=ai.prepare('same',2048),second=ai.prepare('same',2048),chat=ai.complete('same',request);
 const results=Promise.allSettled([first,second,chat]);finish({loaded:true});
 const settled=await results;assert.deepEqual(settled.map(r=>r.status),['fulfilled','fulfilled','fulfilled']);assert.equal(calls,1);
});

test('CUDA failure preserves safe stage/exit/stderr and Auto falls back once on CPU',{skip:process.platform==='win32'},()=>fixture(`
const args=process.argv.slice(2);const get=n=>args[args.indexOf(n)+1];
if(get('--device')!=='none'){
 if(get('--device')!=='CUDA0'||get('--n-gpu-layers')!=='5')process.exit(66);
 console.error('ggml_cuda_init: CUDA error: invalid device function');
 console.error("error: failed to load model '/private/user/model.gguf'");
 console.error('error: --api-key '+get('--api-key'));
 console.error('user: private conversation');process.exitCode=9;
}else{${healthy}}
`,async ai=>{
 ai.gpuLayers=5;ai.probe=async()=>[{backend:'cuda',id:'CUDA0',freeBytes:1}];
 const state=await ai.prepare('same',2048);assert.equal(state.backend,'cpu-native');assert.equal(state.fallbackReason,'gpu-driver-failed');
 assert.equal(state.nativeAttempts.length,2);const failed=state.nativeAttempts[0];
 assert.equal(failed.binary,'cuda/llama-server');assert.equal(failed.stage,'health');assert.equal(failed.exitCode,9);assert.equal(failed.requestedLayers,5);assert.equal(failed.offloadedLayers,0);
 assert.match(failed.stderr,/invalid device function/);assert.doesNotMatch(JSON.stringify(state.nativeAttempts),/private conversation|\/private\/user|model\.gguf/);
 const pid=ai.child.pid;await ai.prepare('same',2048);assert.equal(ai.child.pid,pid);assert.equal(ai.snapshot().nativeAttempts.length,2);
}));
test('classify architecture, memory, file and runtime failures without treating a generic loader failure as unsupported',()=>{
 for(const [log,code] of [['unknown model architecture: lfm3','model-gguf-unsupported'],['invalid GGUF magic','model-gguf-invalid'],['failed to load model: out of memory','model-memory'],['failed to open model: no such file','model-file-unavailable'],['error while loading shared libraries: libcuda.so: cannot open shared object file: No such file or directory','model-native-runtime'],['failed to load model','model-native-load']])assert.equal(classifyLoadFailure(Error('native-start-failed'),log),code);
 assert.equal(classifyLoadFailure(Object.assign(Error('spawn failed'),{code:'ENOENT'}),'','process-start'),'model-native-runtime');
 assert.equal(classifyLoadFailure(Object.assign(Error('spawn failed'),{code:'ENOMEM'}),'','process-start'),'model-memory');
});
test('redaction drops chat and secrets while retaining bounded relevant startup errors',()=>{
 assert.equal(safeStartupLine('user: private question'),'');assert.equal(safeStartupLine('error: prompt includes a private question'),'');
 const safe=safeStartupLine('error: failed to open /home/name/private.gguf --api-key SECRET',['SECRET']);
 assert.doesNotMatch(safe,/home|name|private\.gguf|SECRET/);assert.match(safe,/failed to open/);
 assert.ok(safeStartupLine('CUDA error: '+ 'x'.repeat(2000)).length<=512);
});
test('healthy process without offload evidence is rejected explicitly, never reported GPU active',{skip:process.platform==='win32'},()=>fixture(healthy,async ai=>{
 await assert.rejects(ai.start('same','cuda',{id:'CUDA0'},new AbortController().signal),error=>error.nativeFailureReason==='gpu-offload-unconfirmed');
 const state=ai.snapshot();assert.equal(state.gpuActive,false);assert.equal(state.nativeAttempts[0].stage,'offload');assert.equal(state.nativeAttempts[0].healthHttpStatus,200);
}));
test('late output from a replaced process cannot contaminate a new model load',{skip:process.platform==='win32'},()=>fixture(healthy,async ai=>{
 await ai.start('first','cpu',undefined,new AbortController().signal);const old=ai.child;
 await ai.start('second','cpu',undefined,new AbortController().signal);const replacement=ai.child;
 old.stderr.emit('data',Buffer.from('error: unsupported model architecture; offloaded 99/99 layers to GPU\n'));
 assert.equal(ai.child,replacement);assert.equal(ai.loadedId,'second');assert.equal(ai.offloaded,0);assert.doesNotMatch(ai.log,/unsupported/);
 await ai.setMode('cpu',5);assert.equal(ai.snapshot().loaded,false);assert.equal(ai.child,undefined);
}));

test('GPU active requires generated tokens as well as confirmed offloaded layers',async()=>{
 const ai=new NativeAI({runtimeRoot:'/unused',store:{}});ai.backend='cuda';ai.offloaded=5;ai.memory=async()=>{};
 const original=globalThis.fetch;
 try{for(const tokens of [0,3]){
  globalThis.fetch=async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'answer'},finish_reason:'stop'}],usage:{completion_tokens:tokens}})+'\n\n');
  const result=await ai.stream(request,new AbortController().signal);assert.equal(result.backend.gpuActive,tokens>0);
 }}finally{globalThis.fetch=original;}
});

test('spawn failure identifies the executable rather than blaming the GGUF',{skip:process.platform==='win32'},()=>fixture(healthy,async ai=>{
 ai.binary=()=>path.join(ai.root,'cuda','missing-executable');
 await assert.rejects(ai.start('same','cuda',{id:'CUDA0'},new AbortController().signal),/model-native-runtime/);
 const attempt=ai.snapshot().nativeAttempts[0];assert.equal(attempt.stage,'process-start');assert.equal(attempt.nativeCode,'ENOENT');assert.equal(attempt.reason,'gpu-runtime-unavailable');
}));
