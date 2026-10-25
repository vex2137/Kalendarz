// Synthetic GGUF metadata exercises SAF-equivalent streaming/OPFS transactions and
// restart. These files contain no tensors and are NEVER used as inference evidence.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {existsSync}=require('node:fs');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function fixture(quant){const fields=[['general.architecture','qwen35'],['general.name','Synthetic import fixture'],['general.file_type',quant],['qwen35.context_length',2048]];return Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(1024)]);}
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4192','--strictPort'],{stdio:'ignore'});const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-import-ui-'));let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4192')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  for(const workerOnly of [false,true]){
   const context=await browser.newContext({serviceWorkers:'block'});if(workerOnly)await context.addInitScript(()=>Object.defineProperty(FileSystemFileHandle.prototype,'createWritable',{value:undefined,configurable:true}));
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4192');await page.evaluate(async()=>{window.__testRuntime=await import('/src/utils/localModelRuntime.ts');window.__testRegistry=await import('/src/utils/modelRegistry.ts');await import('/src/utils/localModelStore.ts');});await page.waitForTimeout(1500);await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
   const ids=[];
   for(const [quant,name] of [[15,'Q4_K_M'],[30,'IQ4_XS']]){
    const original=fixture(quant),file=path.join(root,name+'.gguf');await fs.writeFile(file,original);
    await page.getByLabel('Import GGUF',{exact:true}).setInputFiles(file);
    await page.waitForFunction(expected=>{const r=window.__testRuntime,m=window.__testRegistry;return r.modelStatus().phase==='installed'&&r.modelStatus().modelId.startsWith('imported-')&&m.findModel(r.modelStatus().modelId).quantization===expected;},name);
    const state=await page.evaluate(async()=>{const r=await import('/src/utils/localModelRuntime.ts'),m=await import('/src/utils/modelRegistry.ts'),s=await import('/src/utils/localModelStore.ts');const d=m.findModel(r.modelStatus().modelId),saved=await s.savedModel(d);return {id:d.id,quant:d.quantization,bytes:saved?.size,status:r.modelStatus()};});
    assert.equal(state.quant,name);assert.equal(state.bytes,original.length,JSON.stringify(state));ids.push(state.id);assert.deepEqual(await fs.readFile(file),original,'Import must not change the source file');
   }
   assert.notEqual(ids[0],ids[1]);await page.reload();
   const remembered=await page.evaluate(async()=>{const m=await import('/src/utils/modelRegistry.ts'),s=await import('/src/utils/localModelStore.ts');return Promise.all(m.modelChoices().filter(d=>d.imported).map(async d=>({id:d.id,bytes:(await s.savedModel(d)).size})));});
   assert.deepEqual(remembered.map(m=>m.id).sort(),ids.sort());assert.equal(errors.length,0,errors.join('\n'));
   await context.close();
  }
  console.log('GGUF import UI: Q4_K_M + IQ4_XS metadata, distinct hashes, OPFS writer + sync-worker, source preservation and restart passed. No model inference claimed.');
 }finally{await browser?.close();server.kill();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
