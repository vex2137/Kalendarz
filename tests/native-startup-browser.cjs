// Real settings/export UI with a sanitized native-boundary fixture; no GPU claim.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4196','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_MODEL_FREE:'true',CALENDAR_ANDROID_NATIVE:'false'}});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4196')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:900}});
  await context.addInitScript(()=>{
   const status={backend:'cpu-native',mode:'auto',available:true,loaded:false,gpuActive:false,gpuLayers:5,fallbackReason:'gpu-driver-failed',nativeAttempts:[{backend:'cuda',binary:'cuda/llama-server',stage:'health',status:'failed',code:'model-native-load',reason:'gpu-driver-failed',exitCode:9,requestedLayers:5,contextLength:2048,offloadedLayers:0,stderr:'ggml_cuda_init: CUDA error: invalid device function\n'}]};
   window.calendarNativeAI={status:async()=>status,info:async()=>({installed:false}),folders:async()=>({models:[],folders:[],warnings:[]}),stop:async()=>{},setMode:async()=>status};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4196');
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  const details=page.locator('[data-testid=native-startup-details]:visible');
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid=native-startup-details]')].some(e=>e.getClientRects().length&&!e.closest('[inert]')));
  await details.locator('summary').click();await details.locator('p').first().waitFor({state:'visible'});
  const text=await details.innerText();for(const expected of ['CUDA','cuda/llama-server','health','Exit: 9','invalid device function'])assert.ok(text.includes(expected),'Missing '+expected+' in: '+text);
  const report=await page.evaluate(async()=>(await import('/src/utils/modelDiagnostics.ts')).diagnosticsReport());
  assert.equal(report.backend.nativeAttempts[0].requestedLayers,5);assert.equal(report.backend.gpuActive,false);assert.equal(report.backend.nativeAttempts[0].exitCode,9);assert.deepEqual(errors,[]);
  console.log('PASS visible native startup details + diagnostic export on narrow viewport. Native boundary simulated.');
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});
