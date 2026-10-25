// Production click handlers and native boundary fault injection. Mock bridges test
// UI/control flow only; they are never evidence of Android/GPU inference.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),fs=require('node:fs/promises'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4193','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4193')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  await context.addInitScript(()=>{
   window.__bridge={loaded:false,prepares:0,stops:0,stopFailure:false,exportMode:'saved',exportCalls:0};
   window.calendarNativeAI={
    platform:'android',
    status:async()=>({backend:'cpu-native',mode:'cpu',available:true,loaded:window.__bridge.loaded,gpuActive:false,threads:2,gpuAttempt:{stage:'shader-pipeline-create',status:'failed',requestedDevice:'Vulkan0',requestedLayers:999,contextLength:2048,offloadedLayersObserved:0,code:'model-native-load',nativeCode:'VK_ERROR_FEATURE_NOT_PRESENT',exitCode:134,nativeLog:'ggml_vulkan: VK_ERROR_FEATURE_NOT_PRESENT',stages:[]}}),
    info:async()=>({installed:true}),setMode:async()=>window.calendarNativeAI.status(),
    prepare:async()=>{window.__bridge.loaded=true;window.__bridge.prepares++;return window.calendarNativeAI.status();},
    stop:async()=>{window.__bridge.stops++;await new Promise(r=>setTimeout(r,70));if(window.__bridge.stopFailure)throw Error('model-stop-timeout');window.__bridge.loaded=false;},
    folders:async()=>({models:[],folders:[],warnings:[]}),
   };
   // Header + nativePromise exercise the real Capacitor JS proxy, not a mocked
   // export helper. Switching androidBridge changes the platform at runtime.
   window.Capacitor={PluginHeaders:[{name:'CalendarDevice',methods:[{name:'exportDiagnostics',rtype:'promise'},{name:'diagnosticsBuildInfo',rtype:'promise'}]}],nativePromise:async(plugin,method,args)=>{
    if(method==='diagnosticsBuildInfo')return {commit:'test-only',applicationId:'test-only',version:'test-only'};
    if(plugin!=='CalendarDevice'||method!=='exportDiagnostics')throw Error('unexpected native method');
    window.__bridge.exportCalls++;window.__bridge.exported=JSON.parse(args.json);
    await new Promise(r=>setTimeout(r,100));
    if(window.__bridge.exportMode==='failure')throw Error('diagnostics-export-write');
    return {status:window.__bridge.exportMode};
   }};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4193');
  await page.evaluate(async()=>{window.__runtime=await import('/src/utils/localModelRuntime.ts');window.__diagnostics=await import('/src/utils/modelDiagnostics.ts');});
  await page.locator('#btn-open-ai-assistant').click();
  await page.waitForFunction(()=>window.__bridge.loaded);
  await page.locator('#btn-ai-settings').click();await page.locator('#ai-tab-diagnostics').click();
  const attempt=page.locator('[data-testid=gpu-attempt-details]:visible');await attempt.locator('summary').click();await attempt.getByText('model-native-load VK_ERROR_FEATURE_NOT_PRESENT',{exact:false}).waitFor();
  const result=page.getByTestId('diagnostic-action-result');
  await page.getByRole('button',{name:'Release memory',exact:true}).click();
  await result.filter({hasText:'Model unloaded'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__bridge.loaded),false);
  assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().loaded),false);
  // Resume must not instantly reload a manually released model.
  const prepares=await page.evaluate(()=>window.__bridge.prepares);await page.evaluate(()=>window.dispatchEvent(new Event('calendar-app-resume')));await page.waitForTimeout(450);
  assert.equal(await page.evaluate(()=>window.__bridge.prepares),prepares);
  await page.getByRole('button',{name:'Release memory',exact:true}).click();await result.filter({hasText:'already unloaded'}).waitFor();
  // Load again through the actual runtime, then inject a native shutdown error.
  await page.evaluate(async()=>{await window.__runtime.retryLocalModel();window.__bridge.stopFailure=true;});
  await page.getByRole('button',{name:'Release memory',exact:true}).click();await result.filter({hasText:'model-stop-timeout'}).waitFor();
  assert.equal(await result.getAttribute('role'),'alert');assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().loaded),true);
  assert.ok(!await page.evaluate(()=>window.__diagnostics.diagnosticActions().slice(-2).some(e=>e.action==='release-memory'&&e.stage==='success')));
  const retry=await page.evaluate(async()=>{try{await window.__runtime.retryLocalModel();return 'unexpected-success';}catch(error){return error.message;}});
  assert.equal(retry,'model-stop-timeout');assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().phase),'error','A failed shutdown retry must not leave the UI stuck checking');
  await page.evaluate(()=>window.__bridge.stopFailure=false);await page.getByRole('button',{name:'Release memory',exact:true}).click();await result.filter({hasText:'Model unloaded'}).waitFor();
  // Real browser download dispatch contains valid diagnostics and click evidence.
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const file=await download;const json=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(json.version,4);assert.equal(json.backend.gpuAttempt.nativeCode,'VK_ERROR_FEATURE_NOT_PRESENT');assert.equal(json.backend.gpuAttempt.requestedLayers,999);assert.ok(json.actions.some(e=>e.action==='export-json'&&e.stage==='click'));await result.filter({hasText:'download started'}).waitFor();
  // Exercise Android proxy success/cancel/error with visible outcomes.
  await page.evaluate(()=>window.androidBridge={});
  for(const [mode,text] of [['saved','JSON report saved'],['cancelled','Operation cancelled'],['failure','diagnostics-export-write']]){
   await page.evaluate(mode=>window.__bridge.exportMode=mode,mode);await page.getByRole('button',{name:'Export JSON',exact:true}).click();
   await result.filter({hasText:text}).waitFor();assert.equal(await result.getAttribute('role'),mode==='failure'?'alert':'status');
  }
  assert.equal(await page.evaluate(()=>window.__bridge.exportCalls),3);
  assert.equal(await page.evaluate(()=>window.__bridge.exported.actions.at(-1).stage),'start','Snapshot is prepared before its own bridge call');
  assert.ok(await page.evaluate(()=>window.__diagnostics.diagnosticActions().some(e=>e.action==='export-json'&&e.stage==='bridge-call')));
  await page.evaluate(()=>window.Capacitor.PluginHeaders=[]);
  await page.getByRole('button',{name:'Export JSON',exact:true}).click();await result.filter({hasText:'diagnostics-native-unavailable'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__bridge.exportCalls),3,'Missing bridge must not look like a successful save');
  assert.deepEqual(errors,[]);console.log('PASS diagnostic clicks: memory release, no-op, native error/retry, resume pause; browser JSON; Android proxy save/cancel/write error. Native bridge fault injection only.');await context.close();
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
