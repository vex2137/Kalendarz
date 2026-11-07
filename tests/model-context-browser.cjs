// Real UI/runtime/storage with a simulated native boundary; no inference/hardware claim.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function fixture(name,context,blocks){const fields=[['general.architecture','qwen35'],['general.name',name],['qwen35.context_length',context],['qwen35.block_count',blocks]];return [...Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(512)])];}
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4197','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_MODEL_FREE:'true',CALENDAR_ANDROID_NATIVE:'false'}});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4197')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
  await context.addInitScript(()=>{
   const installed=new Set(JSON.parse(localStorage.getItem('test-native-installed')||'[]'));let upload;
   const state=window.__native={loaded:false,stops:0,mode:'auto',gpuLayers:999};
   const snapshot=()=>({...state,backend:'cpu-native',available:true,gpuActive:false,contextLimit:2147483647,availableMemoryBytes:4*1024**3});
   window.calendarNativeAI={status:async()=>snapshot(),registerImported:async()=>{},info:async id=>({installed:installed.has(id),verified:installed.has(id)}),
    folders:async()=>({models:[],folders:[],warnings:[]}),begin:async id=>{upload=id;return installed.has(id)?{exists:true}:{token:'t'};},write:async()=>1,
    finish:async()=>{installed.add(upload);localStorage.setItem('test-native-installed',JSON.stringify([...installed]));return {installed:true};},abortUpload:async()=>{},
    remove:async id=>{installed.delete(id);localStorage.setItem('test-native-installed',JSON.stringify([...installed]));},
    setMode:async(mode,layers)=>{state.mode=mode;state.gpuLayers=layers;return snapshot();},
    prepare:async(id,tokens)=>{state.loaded=true;state.modelId=id;state.contextRequested=tokens;state.contextApplied=tokens;return snapshot();},
    stop:async()=>{state.stops++;state.loaded=false;state.contextApplied=undefined;},
    complete:async()=>{state.generating=true;await new Promise(resolve=>window.__finishGeneration=resolve);state.generating=false;return {text:'A valid answer',finish:'stop',usage:{prompt_tokens:16,completion_tokens:4},timings:{},backend:snapshot()};},
   };
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const open=async()=>{await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();};
  const loadModules=()=>page.evaluate(async()=>{window.__runtime=await import('/src/utils/localModelRuntime.ts');window.__registry=await import('/src/utils/modelRegistry.ts');});
  const importModel=bytes=>page.evaluate(async data=>{await window.__runtime.importLocalModel(new Blob([new Uint8Array(data)]),'fixture.gguf');return window.__runtime.modelStatus().modelId;},bytes);
  await page.goto('http://127.0.0.1:4197');await loadModules();await open();
  const a=await importModel(fixture('Compact Qwen A',32768,24));
  const panel=page.getByTestId('model-context-settings'),number=panel.getByRole('spinbutton'),slider=panel.getByRole('slider');
  await panel.getByRole('checkbox').uncheck();await number.fill('8193');const value=await slider.inputValue();assert.ok(Number(value)>0);
  await slider.fill('500');assert.notEqual(await number.inputValue(),'8193');await number.fill('8193');
  await panel.getByRole('button',{name:'Save context',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('calendar_model_context_v1'))[Object.keys(JSON.parse(localStorage.getItem('calendar_model_context_v1')))[0]].current.tokens===8193);
  await number.fill('32769');assert.equal(await panel.getByRole('button',{name:'Save context',exact:true}).isDisabled(),true);await number.fill('8193');
  await page.locator(`[data-model-id="${a}"]`).getByRole('button',{name:'Load',exact:true}).click();await page.waitForFunction(()=>window.__native.contextRequested===8193&&window.__native.loaded);
  assert.match(await panel.getByTestId('context-applied').innerText(),/Applied by backend: 8193/);
  await page.evaluate(()=>{window.__generation=window.__runtime.inferLocalText('system','hello');});await page.waitForFunction(()=>window.__native.generating);
  const stops=await page.evaluate(()=>window.__native.stops);
  assert.equal(await panel.getByRole('button',{name:'Save context',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(async()=>{try{await window.__runtime.changeLocalContext({mode:'manual',tokens:4096});return 'wrong';}catch(e){return e.message;}}),'model-busy');
  assert.equal(await page.evaluate(()=>window.__native.stops),stops);
  await page.evaluate(async()=>{window.__finishGeneration();await window.__generation;});
  await panel.getByTestId('context-applied').filter({hasText:'Last request usage: 20'}).waitFor();
  const b=await importModel(fixture('Compact Qwen B',65536,32));
  assert.equal(await panel.getByRole('checkbox').isChecked(),true);await panel.getByRole('checkbox').uncheck();await number.fill('16384');await panel.getByRole('button',{name:'Save context',exact:true}).click();
  await page.waitForTimeout(50);await page.reload();await loadModules();await open();assert.equal(await number.inputValue(),'16384');
  await page.locator(`[data-model-id="${a}"]`).getByRole('button',{name:'Use',exact:true}).click();await page.waitForFunction(()=>window.__runtime.modelStatus().modelId===window.__registry.findModel(window.__runtime.modelStatus().modelId).id&&window.__native.contextRequested===8193);
  assert.equal(await number.inputValue(),'8193');assert.match(await page.locator('[data-testid=model-layer-counts]:visible').innerText(),/Total model layers: 24/);assert.match(await page.locator('[data-testid=model-layer-counts]:visible').innerText(),/Confirmed GPU offload: Unknown/);
  for(const width of [1280,768,390]){await page.setViewportSize({width,height:900});const rows=page.locator('[data-model-id]:visible');for(let i=0;i<await rows.count();i++){const row=rows.nth(i);assert.ok(await row.evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.ok((await row.boundingBox()).height<150);}}
  const rowB=page.locator(`[data-model-id="${b}"]`);await rowB.locator('summary').click();await rowB.getByRole('button',{name:/Remove/}).click();await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('test-native-installed')).includes(id),b);
  await importModel(fixture('Compact Qwen B',65536,32));assert.equal(await number.inputValue(),'16384');
  await panel.getByRole('button',{name:'Revert previous setting',exact:true}).click();await panel.getByRole('checkbox').waitFor();assert.equal(await panel.getByRole('checkbox').isChecked(),true);
  assert.deepEqual(errors,[]);console.log('PASS context slider/exact input, validation, per-model restart/reimport, applied capacity/usage, busy safety, compact 1280/768/390 rows and secondary deletion. Native boundary simulated.');
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});
