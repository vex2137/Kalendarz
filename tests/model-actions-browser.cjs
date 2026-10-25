// UI/HTTP/SAF bridge regressions using synthetic model bytes and injected picker
// responses. This verifies storage/control flow, never model inference or hardware.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
const fields=[['general.architecture','qwen35'],['general.name','SAF regression fixture'],['general.file_type',30],['qwen35.context_length',2048]];
const bytes=Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(1024)]);
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4194','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4194')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(bytes=>{
   window.__picker={mode:'file',releases:0};
   window.Capacitor={PluginHeaders:[{name:'CalendarModelImport',methods:[{name:'pick',rtype:'promise'},{name:'release',rtype:'promise'}]}],nativePromise:async(plugin,method)=>{
    if(method==='release'){window.__picker.releases++;return;}
    if(method==='pick')return window.__picker.mode==='cancel'?{cancelled:true}:{token:'11111111-1111-4111-8111-111111111111',bytes,name:'fixture-IQ4_XS.gguf'};
    throw Error('unexpected-native-call');
   }};
  },bytes.length);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://huggingface.co/**',route=>route.fulfill({status:404,body:'missing test artifact'}));
  let importHttp=200;await page.route('**/_calendar_model_import/**',route=>route.fulfill({status:importHttp,contentType:'application/octet-stream',body:importHttp===200?bytes:Buffer.from('expired token')}));
  await page.goto('http://127.0.0.1:4194');await page.evaluate(async()=>{window.__runtime=await import('/src/utils/localModelRuntime.ts');window.__diagnostics=await import('/src/utils/modelDiagnostics.ts');});
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  const optional=page.locator('[data-model-id="lfm2.5-350m-q4-k-m"]');await optional.getByRole('button',{name:'Use model',exact:true}).click();await optional.getByRole('button',{name:'Download',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'404'}).waitFor();
  assert.ok(await page.evaluate(()=>window.__diagnostics.diagnosticActions().some(e=>e.action==='download-model'&&e.stage==='error'&&e.code==='model-http-404')));
  assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().installed),false);
  assert.equal(await page.getByTestId('model-operation-result').count(),0,'Failed downloads cannot claim successful installation');
  await page.evaluate(()=>window.androidBridge={});
  await page.locator('#ai-import-gguf').click();await page.getByTestId('model-operation-result').filter({hasText:'installed and verified'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().installed),true);
  assert.equal(await page.evaluate(()=>window.__picker.releases),1);
  importHttp=404;await page.locator('#ai-import-gguf').click();await page.getByRole('alert').filter({hasText:'Cannot read the selected document'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__picker.releases),2);
  assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().installed),true,'Failed import must preserve the earlier installed copy');
  assert.ok(await page.evaluate(()=>window.__diagnostics.diagnosticActions().some(e=>e.action==='import-gguf'&&e.stage==='error'&&e.code==='model-import-file')));
  await page.evaluate(()=>window.__picker.mode='cancel');await page.locator('#ai-import-gguf').click();await page.getByTestId('model-operation-result').filter({hasText:'Operation cancelled'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__picker.releases),2,'Cancelling a picker does not invent or release a file token');
  assert.deepEqual(errors,[]);console.log('PASS model action UI: download HTTP 404 -> visible failure/no false success; Android picker proxy + streamed GGUF storage; expired grant -> readable error/old model retained; picker cancel -> visible outcome.');
  await context.close();
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
