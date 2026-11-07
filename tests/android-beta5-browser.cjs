// Real Capacitor JS adapter under Android platform headers; transport is mocked.
// No device, GGUF, native loading or inference is claimed by this test.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4198','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_ANDROID_NATIVE:'true'}});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4198')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:915}});
  await page.route('**/android-adapter-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.addInitScript(()=>{
   window.__CALENDAR_BUILD__={version:"1.5.0",androidNative:true,dirty:true,commit:"fixture",branch:"fixture",builtAt:"fixture"};
   window.androidBridge={};window.__calls=[];
   const names=['status','info','begin','write','finish','abortUpload','prepare','complete','stop','setMode','remove'];
   window.Capacitor={PluginHeaders:[{name:'CalendarNativeAI',methods:names.map(name=>({name,rtype:'promise'}))}],nativePromise:async(plugin,method,options)=>{
    window.__calls.push({plugin,method,options});
    if(method==='status'||method==='prepare'||method==='setMode')return {available:true,backend:'cpu-native',mode:'auto',gpuActive:false};
    if(method==='begin')return {token:'import-token'};
    if(method==='write')return {bytes:3};
    if(method==='complete')return {text:'null is valid text',finish:'stop',usage:{completion_tokens:5}};
    return {};
   }};
  });
  await page.goto('http://127.0.0.1:4198/android-adapter-fixture');
  const result=await page.evaluate(async()=>{
   const {androidAIReady,androidAI}=await import('/src/utils/nativeAndroidAI.ts');await androidAIReady;
   const {findModel}=await import('/src/utils/modelRegistry.ts');const model=findModel();
   const bridge=androidAI();if(!bridge)throw Error('Android native bridge unavailable '+JSON.stringify({build:(await import('/src/utils/buildInfo.ts')).BUILD_INFO,platform:window.Capacitor.getPlatform(),available:window.Capacitor.isPluginAvailable('CalendarNativeAI'),calls:window.__calls}));
   await bridge.info(model.id);await bridge.begin(model.id);await bridge.write('import-token',new Uint8Array([0,128,255]));await bridge.finish('import-token');
   await bridge.prepare(model.id,8193);
   const answer=await bridge.complete(model.id,{messages:[{role:'user',content:'Explain null'}],max_tokens:1500,temperature:0.3});
   await bridge.stop();await bridge.abortUpload('import-token');await bridge.remove(model.id);
   let invalid=false;try{await bridge.prepare('not-a-model',2048);}catch{invalid=true;}
   return {platform:bridge.platform,answer,calls:window.__calls,invalid};
  });
  assert.equal(result.platform,'android');assert.equal(result.invalid,true);assert.equal(result.answer.text,'null is valid text');
  assert.equal(result.calls.find(c=>c.method==='prepare').options.contextSize,8193);
  assert.equal(result.calls.find(c=>c.method==='complete').options.request.max_tokens,1500);
  assert.equal(result.calls.find(c=>c.method==='complete').options.request.messages[0].content,'Explain null');
  assert.equal(result.calls.find(c=>c.method==='write').options.data,'AID/');
  for(const method of ['info','begin','finish','stop','abortUpload','remove'])assert.ok(result.calls.some(c=>c.method===method));
  console.log('PASS Android Capacitor adapter: context, 1500-token budget, literal null, bounded import bytes, stop/remove/abort and invalid model rejection. Native transport mocked.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
