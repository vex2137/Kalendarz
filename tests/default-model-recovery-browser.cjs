// Real OPFS, HTTP, production runtime and actual Node NativeModelStore. Synthetic
// GGUF metadata is used only for transfer tests, never claimed as model inference.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const {NativeModelStore,packagedModelId}=require('../electron/native-model-store.cjs');
const id=require('../src/utils/localModelManifest.json').id;
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
const fields=[['general.architecture','qwen35'],['general.file_type',15],['qwen35.block_count',25],['qwen35.context_length',262144]];
const data=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(8192)]),sha=crypto.createHash('sha256').update(data).digest('hex');
const base='http://127.0.0.1:4208';
(async()=>{let browser,modelStore,failCommit=false,requests=0;const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-default-opfs-'));const fileServer=http.createServer((req,res)=>{requests++;res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Length':data.length,'ETag':'"fixture"'});res.end(data)});await new Promise(r=>fileServer.listen(0,'127.0.0.1',r));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4208','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_MODEL_FREE:'true',CALENDAR_ANDROID_NATIVE:'false'}});
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const mode of ['download','import-stream','partial','corrupt','duplicate']){
  modelStore=new NativeModelStore({root:path.join(root,mode),catalogue:[{id,bytes:data.length,sha256:sha}],bundledPath:'/not-packaged.gguf',bundledId:packagedModelId({distribution:'model-free',bundledModel:false},{id})});
  const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
  await page.exposeFunction('nativeCall',async(method,...args)=>{if(method==='finish'&&failCommit){await modelStore.abort(args[0]);throw Error('model-storage');}return modelStore[method](...args.map((arg,i)=>method==='write'&&i===1?Buffer.from(arg):arg));});
  await page.addInitScript(()=>{window.calendarNativeAI={info:id=>window.nativeCall('info',id),begin:id=>window.nativeCall('begin',id),write:(token,chunk)=>window.nativeCall('write',token,Array.from(chunk)),finish:token=>window.nativeCall('finish',token),abortUpload:token=>window.nativeCall('abort',token),remove:id=>window.nativeCall('remove',id),stop:async()=>{},status:async()=>({backend:'cpu-native',mode:'cpu',loaded:false,available:true,gpuActive:false}),folders:async()=>({models:[],folders:[],warnings:[]})};});
  const prepare=async()=>{await page.goto(base);await page.evaluate(async fixture=>{const registry=await import('/src/utils/modelRegistry.ts');Object.assign(registry.DEFAULT_MODEL,fixture);window.r=await import('/src/utils/localModelRuntime.ts');window.s=await import('/src/utils/localModelStore.ts');await window.r.selectLocalModel(fixture.id);localStorage.setItem('calendar-data-marker','preserved');},{id,bytes:data.length,sha256:sha,url:'http://127.0.0.1:'+fileServer.address().port+'/model',bundled:false});};
  await page.route('**/_calendar_model_import/fixture',route=>route.fulfill({body:data,headers:{'Content-Type':'application/octet-stream'}}));
  await prepare();const before=requests;
  if(mode==='download'||mode==='import-stream'){
   failCommit=true;
   const failed=await page.evaluate(async({mode,bytes})=>{try{if(mode==='download')await window.r.installLocalModel();else await window.r.importLocalModel({url:location.origin+'/_calendar_model_import/fixture',bytes},'default.gguf');}catch(e){return e.message;}},{mode,bytes:data.length});
   // Stream imports use a real local HTTP source; expose its bytes via Vite routing.
   if(mode==='import-stream'&&failed==='model-http-404')throw Error('Import fixture route missing');
   assert.ok(failed,mode);assert.equal((await modelStore.info(id)).installed,false);
   const retained=await page.evaluate(async()=>{const d=await(await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');return Promise.all((await(async()=>{const a=[];for await(const h of d.values())a.push(h);return a;})()).filter(h=>h.kind==='file').map(async h=>({name:h.name,size:(await h.getFile()).size})));});assert.ok(retained.some(f=>f.name.endsWith('.gguf')&&f.size===data.length),JSON.stringify({mode,retained}));
   failCommit=false;await modelStore.close();modelStore=new NativeModelStore({root:path.join(root,mode),catalogue:[{id,bytes:data.length,sha256:sha}]});
   const networkBeforeRetry=requests;await prepare();await page.evaluate(async()=>{await window.r.checkLocalModel();if(!window.r.modelStatus().installed)throw Error('Complete verified OPFS was not recovered');await window.r.installLocalModel();});assert.equal(requests,networkBeforeRetry,'Recovery must not request the model again');assert.equal((await modelStore.info(id)).verified,true);
  }else if(mode==='duplicate'){
   await page.evaluate(async bytes=>{const b=new Blob([new Uint8Array(bytes)]);await window.r.importLocalModel(b,'qwen.gguf');await window.r.importLocalModel(b,'qwen-copy.gguf');},Array.from(data));assert.equal((await fs.readdir(path.join(root,mode))).filter(n=>n.endsWith('.gguf')).length,1);
  }else{
   await page.evaluate(async({bytes,mode})=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models',{create:true});const h=await dir.getFileHandle('transfer-'+ 'a'.repeat(64)+'.gguf',{create:true}),w=await h.createWritable();await w.write(mode==='partial'?new Uint8Array(bytes).slice(0,100):new Uint8Array(bytes).fill(0));await w.close();await window.r.checkLocalModel();if(window.r.modelStatus().installed)throw Error('Unverified bytes became installed');},{bytes:Array.from(data),mode});assert.equal(requests,before);assert.equal((await modelStore.info(id)).installed,false);
   if(mode==='corrupt'){const error=await page.evaluate(async bytes=>{try{await window.r.importLocalModel(new Blob([new Uint8Array(bytes).fill(0)]),'bad.gguf');}catch(e){return e.message;}},Array.from(data));assert.match(error,/gguf/);}
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('calendar-data-marker')),'preserved');console.log('PASS default model-free:',mode);await context.close();await modelStore.close();
 }
}finally{await browser?.close();vite.kill();fileServer.closeAllConnections();await new Promise(r=>fileServer.close(r));await modelStore?.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
