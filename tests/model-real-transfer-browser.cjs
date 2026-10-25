// Real GGUF, real HTTP redirect/download/OPFS and real WASM inference. The Android
// bridge fault is injected only to prove storage is independent of native upload.
// This is Linux Chromium evidence, never proof of physical Android/SAF operation.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),{createReadStream,existsSync}=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const source=process.env.CALENDAR_MODEL_FILE;if(!source)throw Error('Set CALENDAR_MODEL_FILE to the verified LFM2.5 350M Q4_K_M');
 const descriptor=require('../src/utils/optionalModels.json')[0];const stat=await fs.stat(source);assert.equal(stat.size,descriptor.bytes);
 const digest=crypto.createHash('sha256');for await(const chunk of createReadStream(source))digest.update(chunk);assert.equal(digest.digest('hex'),descriptor.sha256);
 const handle=await fs.open(source,'r'),header=Buffer.alloc(64*1024);await handle.read(header,0,header.length,0);await handle.close();const nameOffset=header.indexOf(Buffer.from('LFM2.5-350M'));assert.ok(nameOffset>24);
 let downloads=0;const transfers=http.createServer((request,response)=>{
  response.setHeader('Access-Control-Allow-Origin','*');
  if(request.url==='/redirect'){response.writeHead(302,{Location:'/weights'}).end();return;}
  if(request.url==='/weights'){downloads++;response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':stat.size});createReadStream(source).pipe(response);return;}
  response.writeHead(404).end('missing');
 });await new Promise(resolve=>transfers.listen(0,'127.0.0.1',resolve));const downloadUrl=`http://127.0.0.1:${transfers.address().port}/redirect`;
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4195','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4195')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(()=>{
   window.__nativeUploads=0;window.calendarNativeAI={platform:'android',info:async id=>{if(!/^[a-z0-9][a-z0-9._-]{0,89}$/.test(id)||id.includes('..'))throw Error('model-input');return {installed:false};},stop:async()=>{},status:async()=>({backend:'cpu-native',mode:'auto',loaded:false,gpuActive:false,available:true}),prepare:async()=>{throw Error('model-native-unavailable');},begin:async()=>{window.__nativeUploads++;throw Error('native upload must not gate installation');},setMode:async()=>window.calendarNativeAI.status()};
  });
  const page=await context.newPage();page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4195');
  await page.evaluate(async()=>{window.__r=await import('/src/utils/localModelRuntime.ts');window.__m=await import('/src/utils/modelRegistry.ts');window.__s=await import('/src/utils/localModelStore.ts');});
  await page.evaluate(async({id,url})=>{const d=window.__m.findModel(id);d.url=url;await window.__r.selectLocalModel(id);await window.__r.installLocalModel();if(!window.__r.modelStatus().installed)throw Error('download not committed');await window.__s.verifyModel(await window.__s.savedModel(d),undefined,undefined,d);await window.__r.installLocalModel();},{id:descriptor.id,url:downloadUrl});
  assert.equal(downloads,1,'Retry must adopt verified data without another download');assert.equal(await page.evaluate(()=>window.__nativeUploads),0,'Android installation must use the 1.4.0 OPFS commit, not require native upload');
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  const chooser=page.waitForEvent('filechooser');await page.locator('#ai-import-gguf').click();await(await chooser).setFiles(source);
  await page.getByTestId('model-operation-result').filter({hasText:'Model installed and verified'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__r.modelStatus().modelId),descriptor.id);
  const imported=await page.evaluate(async offset=>{
   const file=document.querySelector('input[type=file][accept*=".gguf"]').files?.[0];
   // The UI clears the input. Use a File snapshot from the saved verified bytes.
   const original=await window.__s.savedModel(window.__m.findModel(window.__r.modelStatus().modelId));
   const custom=new File([original.slice(0,offset),new Uint8Array([88]),original.slice(offset+1)],'outside-catalogue-LFM.gguf');
   await window.__r.importLocalModel(custom,custom.name);const d=window.__m.findModel(window.__r.modelStatus().modelId);
   if(!d.imported||!d.id.startsWith('imported-'))throw Error('local variant was forced into the catalogue');
   await window.__s.verifyModel(await window.__s.savedModel(d),undefined,undefined,d);return {id:d.id,sha:d.sha256,bytes:d.bytes,name:d.name};
  },nameOffset);
  assert.notEqual(imported.sha,descriptor.sha256);assert.equal(imported.bytes,descriptor.bytes);assert.ok(imported.name.startsWith('XFM'));
  await page.reload();
  const result=await page.evaluate(async id=>{
   const r=await import('/src/utils/localModelRuntime.ts'),m=await import('/src/utils/modelRegistry.ts'),s=await import('/src/utils/localModelStore.ts'),metrics=await import('/src/utils/modelDiagnostics.ts');
   if(m.activeModel().id!==id)throw Error('import selection lost after restart');await r.checkLocalModel();if(!r.modelStatus().installed)throw Error('import not present after restart');
   const answer=await r.inferLocalText('Reply briefly.','Say hello.',[],{maxTokens:8,timeoutMs:180000});const metric=metrics.modelMetrics().filter(x=>x.route==='model').at(-1);
   await r.releaseLocalModelMemory();await s.verifyModel(await s.savedModel(m.findModel(id)),undefined,undefined,m.findModel(id));return {answer,metric,installed:r.modelStatus().installed,loaded:r.modelStatus().loaded};
  },imported.id);
  assert.ok(result.answer.trim());assert.ok(result.metric.completionTokens>0);assert.equal(result.metric.backend,'cpu-wasm');assert.equal(result.installed,true);assert.equal(result.loaded,false);assert.deepEqual(errors,[]);
  const evidence={environment:'Linux Chromium; injected native-unavailable boundary, actual WASM inference',physicalAndroid:false,original:{id:descriptor.id,bytes:descriptor.bytes,sha256:descriptor.sha256},outsideCatalogue:{...imported,change:'Only the first byte of general.name was changed; tensor weights were unchanged'},httpRedirect:true,downloadCount:downloads,inference:result.metric,passed:true};
  if(process.env.CALENDAR_TRANSFER_REPORT)await fs.writeFile(process.env.CALENDAR_TRANSFER_REPORT,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));await context.close();
 }finally{await browser?.close();server.kill();await new Promise(resolve=>transfers.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
