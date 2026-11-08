const assert=require('node:assert/strict'),{chromium}=require('playwright'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs');
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4199','--strictPort'],{stdio:'ignore'});let browser;
try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4199')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
for(const width of [390,1280]){const page=await browser.newPage({viewport:{width,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.androidBridge={};window.__computeCalls=0;window.__mutations=[];
 const backend=()=>({available:true,backend:'cpu-native',mode:'gpu',gpuActive:false,offloadedLayers:0,packagedBackends:['cpu-native'],availableBackends:[],nativeRuntime:{version:'b12189',vulkanLinkage:'not-packaged'}});
 window.calendarNativeAI={status:async()=>backend(),info:async()=>({installed:true}),folders:async()=>({models:[],folders:[],warnings:[]}),setMode:async()=>{window.__mutations.push('setMode');return backend();},prepare:async()=>{window.__mutations.push('prepare');return backend();}};
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});
 window.Capacitor={PluginHeaders:[{name:'CalendarGpuDiagnostics',methods:['discover','testCompute'].map(name=>({name,rtype:'promise'}))},{name:'CalendarDevice',methods:['diagnosticsBuildInfo','setLanguage','setSystemBarColors'].map(name=>({name,rtype:'promise'}))}],nativePromise:async(plugin,method)=>{
  if(plugin==='CalendarDevice')return {commit:'fixture',applicationId:'com.kalendarz.offline.diagnostics',version:'1.5.0-part2-beta.6'};
  const device={deviceName:'Fixture GPU (mock)',vendorID:0x5143,deviceID:42,deviceType:'integrated',softwareDevice:false,apiVersion:'1.3.0',driverVersionRaw:123,computeQueueAvailable:true};
  if(method==='discover')return {version:1,probeVersion:'beta6-v1',success:true,stage:'discovered',hardwareGpuDetected:true,physicalDevices:[device],selectedDevice:device,loader:{available:true,apiVersion:'1.3.0'}};
  window.__computeCalls++;await new Promise(r=>setTimeout(r,150));if(window.__computeCalls===2)return {version:1,success:false,stage:'queue-submit',errorCode:'vulkan-probe-failed',vkResult:-4};
  if(window.__computeCalls===3)return {version:1,success:false,stage:'watchdog',errorCode:'vulkan-probe-timeout'};
  if(window.__computeCalls===4)return {version:1,success:true,stage:'device-create'};
  return {version:1,success:true,stage:'result-verified',durationMs:12,compute:{verified:true,elements:64}};
 }};
});
await page.goto('http://127.0.0.1:4199/tests/beta6-gpu.html');await page.getByText(/GPU wykryte — backend inferencji Vulkan/).waitFor();
await page.waitForFunction(()=>JSON.parse(document.querySelector('#ai-diagnostics-report').textContent).androidGpu.discovery?.physicalDevices?.[0]?.deviceName==='Fixture GPU (mock)');
assert.equal(await page.evaluate(()=>window.__computeCalls),0);assert.deepEqual(await page.evaluate(()=>window.__mutations),[]);
await page.getByTestId('gpu-compute-test').click();await page.getByTestId('gpu-compute-status').filter({hasText:'Wynik Compute zweryfikowany'}).waitFor();
await page.getByRole('button',{name:'Kopiuj pełną diagnostykę',exact:true}).click();let report=await page.evaluate(()=>JSON.parse(window.__copied));assert.equal(report.androidGpu.computeTest.compute.verified,true);assert.equal(report.backend.backend,'cpu-native');assert.equal(report.backend.mode,'gpu');assert.equal(report.backend.gpuActive,false);
for(const expected of ['queue-submit','vulkan-probe-timeout','vulkan-result-unverified']){await page.getByTestId('gpu-compute-test').click();await page.getByTestId('gpu-compute-status').filter({hasText:'Test w toku…'}).waitFor();assert.ok(!(await page.getByTestId('gpu-compute-status').innerText()).includes('zweryfikowany'));await page.getByTestId('gpu-compute-status').filter({hasText:expected}).waitFor();}
assert.deepEqual(await page.evaluate(()=>window.__mutations),[]);assert.equal(await page.evaluate(()=>window.__computeCalls),4);assert.deepEqual(errors,[]);await page.close();}
console.log('PASS GPU diagnostic UI at 390/1280px: independent discovery, no automatic Compute, no inference/model changes, verified-only success, device-lost/timeout/unverified errors, full JSON copy. Native transport mocked.');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
