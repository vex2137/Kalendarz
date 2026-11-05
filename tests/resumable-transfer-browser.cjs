// Local HTTP/OPFS integration fixtures test transfer integrity, never inference quality.
const assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');const {chromium}=require('playwright');
const payload=Buffer.alloc(6*1024*1024);for(let i=0;i<payload.length;i++)payload[i]=i%251;payload.write('GGUF');
const sha=crypto.createHash('sha256').update(payload).digest('hex');
(async()=>{
 const requests=[];let browser;const counts=new Map();
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),mode=url.searchParams.get('mode');
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Range, If-Range');res.setHeader('Access-Control-Expose-Headers','ETag, Content-Range, Content-Length');
  if(req.method==='OPTIONS'){res.end();return;}
  const count=(counts.get(req.url)||0)+1;counts.set(req.url,count);
  requests.push({mode,range:req.headers.range,validator:req.headers['if-range']});
  if(mode==='http'&&count===2){res.writeHead(503);res.end();return;}
  const offset=Number((req.headers.range||'').match(/bytes=(\d+)-/)?.[1]||0);
  const partial=offset>0&&mode!=='ignore';
  res.statusCode=partial?206:200;
  if(mode!=='noetag')res.setHeader('ETag',mode==='changed'&&offset?'"v2"':'"v1"');
  if(partial)res.setHeader('Content-Range',`bytes ${mode==='bad-range'?offset+1:offset}-${payload.length-1}/${payload.length}`);
  if(mode==='range416'&&offset){res.writeHead(416);res.end();return;}
  const start=partial?offset:0;res.setHeader('Content-Length',payload.length-start-(mode==='bad-length'?1:0));
  let sent=start;const timer=setInterval(()=>{
   if(mode==='stall'&&count===1&&sent>=1024*1024)return;
   if(mode==='crash'&&count===1&&sent>=5*1024*1024)return;
   if(mode==='disconnect'&&count===1&&sent>=2*1024*1024){clearInterval(timer);res.destroy();return;}
   const end=Math.min(sent+128*1024,payload.length);const chunk=Buffer.from(payload.subarray(sent,end));if(mode==='corrupt')chunk[0]^=1;
   res.write(chunk);sent=end;if(sent===payload.length){clearInterval(timer);res.end();}
  },4);res.on('close',()=>clearInterval(timer));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4192','--strictPort'],{stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4192')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  for(const workerOnly of [false,true]){
   const context=await browser.newContext({serviceWorkers:'block'});
   if(workerOnly)await context.addInitScript(()=>Object.defineProperty(FileSystemFileHandle.prototype,'createWritable',{value:undefined,configurable:true}));
   const page=await context.newPage();await page.goto('http://127.0.0.1:4192');
   for(const mode of workerOnly?['resume','corrupt']:['resume','ignore','bad-range','changed','noetag','range416','disconnect','http','stall','quota','bad-length','corrupt']){
    const descriptor={id:'fixture-'+mode+'-'+workerOnly,name:'Fixture',file:'fixture.gguf',bytes:payload.length,sha256:sha,url:origin+'/model?mode='+mode+'&worker='+workerOnly,revision:'test',architecture:'qwen35',quantization:'Q4_K_M',maxContext:1024,estimatedRamMB:20};
    const attempt=async(abort=false,save=false,timeout=10000)=>page.evaluate(async({descriptor,abort,save,timeout})=>{
     const store=await import('/src/utils/localModelStore.ts'),transfer=await import('/src/utils/resumableModelTransfer.ts');
     const controller=new AbortController();
     try{
      const file=await transfer.resumableModelTransfer(descriptor,controller.signal,n=>{if(abort&&n>=2*1024*1024)controller.abort();},f=>store.verifyModel(f,controller.signal,undefined,descriptor),async()=>{},timeout);
      if(save){await store.saveModel(file,controller.signal,descriptor);await transfer.removeModelTransfer(descriptor);await store.verifyModel(await store.savedModel(descriptor),undefined,undefined,descriptor);}
      return {size:file.size,remaining:await transfer.modelTransferBytes(descriptor)};
     }catch(e){return {error:e.name==='AbortError'?'aborted':e.message,remaining:await transfer.modelTransferBytes(descriptor)};}
    },{descriptor,abort,save,timeout});
    if(mode==='bad-length'){const result=await attempt();assert.equal(result.error,'model-download-range');assert.equal(result.remaining,0);continue;}
    if(mode==='corrupt'){
     await page.evaluate(async descriptor=>{const store=await import('/src/utils/localModelStore.ts');const data=new Uint8Array(descriptor.bytes);for(let i=0;i<data.length;i++)data[i]=i%251;data.set(new TextEncoder().encode('GGUF'));await store.saveModel(new Blob([data]),new AbortController().signal,descriptor);},descriptor);
     const result=await attempt();assert.equal(result.error,'model-checksum');assert.equal(result.remaining,0);
     assert.equal(await page.evaluate(async descriptor=>{const store=await import('/src/utils/localModelStore.ts');await store.verifyModel(await store.savedModel(descriptor),undefined,undefined,descriptor);return true;},descriptor),true);
     console.log('PASS corrupt transfer preserves installed model',workerOnly);continue;
    }
    const first=await attempt(!['disconnect','stall'].includes(mode),false,mode==='stall'?250:10000);
    assert.ok(first.error,mode+': initial interruption');assert.ok(first.remaining>0&&first.remaining<payload.length,JSON.stringify({mode,first}));
    await page.reload(); // new JS module instances; durable state must come from OPFS.
    if(mode==='http'){const failed=await attempt();assert.equal(failed.error,'model-http-503');assert.equal(failed.remaining,first.remaining);}
    if(mode==='quota'&&!workerOnly){
     const noSpace=await page.evaluate(async descriptor=>{const transfer=await import('/src/utils/resumableModelTransfer.ts');try{await transfer.resumableModelTransfer(descriptor,new AbortController().signal,()=>{},async()=>{},async()=>{throw Error('model-storage-space');});}catch(e){return {error:e.message,remaining:await transfer.modelTransferBytes(descriptor)};}},descriptor);
     assert.equal(noSpace.error,'model-storage-space');assert.equal(noSpace.remaining,first.remaining);
     const result=await page.evaluate(async descriptor=>{
      const original=FileSystemWritableFileStream.prototype.write;FileSystemWritableFileStream.prototype.write=function(data){if(data instanceof Uint8Array&&data.length>1024)throw new DOMException('full','QuotaExceededError');return original.call(this,data);};
      const transfer=await import('/src/utils/resumableModelTransfer.ts');
      try{await transfer.resumableModelTransfer(descriptor,new AbortController().signal,()=>{},async()=>{},async()=>{});}catch(e){return {error:e.name,remaining:await transfer.modelTransferBytes(descriptor)};}finally{FileSystemWritableFileStream.prototype.write=original;}
     },descriptor);assert.equal(result.error,'QuotaExceededError');assert.equal(result.remaining,first.remaining);
    }
    const result=await attempt(false,true);assert.equal(result.error,undefined,JSON.stringify({mode,result}));assert.equal(result.size,payload.length);assert.equal(result.remaining,0);
    const calls=requests.filter(r=>r.mode===mode);const resumed=calls.find(r=>r.range);
    if(mode==='noetag')assert.equal(resumed,undefined);
    else{assert.ok(resumed,mode+': Range missing');assert.equal(resumed.validator,'"v1"');}
    console.log('PASS',mode,workerOnly?'worker OPFS':'transactional OPFS');
   }
   // Exercise the production store path, which must automatically retain cancellation and register after verify/save.
   const storeResult=await page.evaluate(async({origin,sha,bytes})=>{
    const store=await import('/src/utils/localModelStore.ts');const descriptor={id:'store-flow',name:'Fixture',file:'x.gguf',bytes,sha256:sha,url:origin+'/model?mode=store',revision:'test'};
    const c=new AbortController();try{await store.downloadModel(c.signal,n=>{if(n>=1024*1024)c.abort();},descriptor);}catch{}
    await store.cleanPartialModels(descriptor);
    const file=await store.downloadModel(new AbortController().signal,()=>{},descriptor);
    await store.saveModel(file,new AbortController().signal,descriptor);await store.verifyModel(await store.savedModel(descriptor),undefined,undefined,descriptor);const transfer=await import('/src/utils/resumableModelTransfer.ts');if(await transfer.modelTransferBytes(descriptor)!==0)throw Error('Committed transfer was not cleaned');return true;
   },{origin,sha,bytes:payload.length});assert.equal(storeResult,true);
   const crashDescriptor={id:'crash-'+workerOnly,bytes:payload.length,sha256:sha,url:origin+'/model?mode=crash&worker='+workerOnly};
   await page.evaluate(async d=>{const transfer=await import('/src/utils/resumableModelTransfer.ts');window.crashProgress=0;window.crashedTransfer=transfer.resumableModelTransfer(d,new AbortController().signal,n=>{window.crashProgress=n;},async()=>{},async()=>{}).catch(()=>{});},crashDescriptor);
   await page.waitForFunction(()=>window.crashProgress>=5*1024*1024);
   await page.reload();
   assert.equal(await page.evaluate(async d=>{const store=await import('/src/utils/localModelStore.ts');const file=await store.downloadModel(new AbortController().signal,()=>{},d);await store.saveModel(file,new AbortController().signal,d);await store.verifyModel(await store.savedModel(d),undefined,undefined,d);return true;},crashDescriptor),true);
   assert.ok(requests.some(r=>r.mode==='crash'&&r.range));
   console.log('PASS abrupt document restart resumes committed checkpoint',workerOnly);
   const offline=await page.evaluate(async({origin,sha,bytes,workerOnly})=>{
    const transfer=await import('/src/utils/resumableModelTransfer.ts'),store=await import('/src/utils/localModelStore.ts');
    const d={id:'complete-'+workerOnly,bytes,sha256:sha,url:origin+'/model?mode=complete&worker='+workerOnly};const c=new AbortController();
    try{await transfer.resumableModelTransfer(d,c.signal,()=>{},async()=>{c.abort();throw c.signal.reason;},async()=>{});}catch{}
    const original=window.fetch;window.fetch=async()=>{throw Error('unexpected network');};
    try{const file=await transfer.resumableModelTransfer(d,new AbortController().signal,()=>{},f=>store.verifyModel(f,undefined,undefined,d),async()=>{});await transfer.removeModelTransfer(d);return file.size;}finally{window.fetch=original;}
   },{origin,sha,bytes:payload.length,workerOnly});assert.equal(offline,payload.length);
   const exclusive=await page.evaluate(async({origin,sha,bytes})=>{
    const transfer=await import('/src/utils/resumableModelTransfer.ts');
    const d={id:'exclusive',bytes,sha256:sha,url:origin+'/model?mode=stall&lock=1'};
    const c=new AbortController();let entered;const ready=new Promise(r=>entered=r);
    const first=transfer.resumableModelTransfer(d,c.signal,n=>{if(n>0)entered();},async()=>{},async()=>{},1000).catch(()=>{});
    await ready;
    let error;try{await transfer.resumableModelTransfer(d,new AbortController().signal,()=>{},async()=>{},async()=>{});}catch(e){error=e.message;}
    c.abort();await first;await transfer.removeModelTransfer(d);return error;
   },{origin,sha,bytes:payload.length});assert.equal(exclusive,'model-busy');
   await context.close();
  }
  console.log('PASS local HTTP resume/restart, validators, interruption, errors, checksum and verified registration');
 }finally{await browser?.close();vite.kill();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
