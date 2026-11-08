// Real sandboxed Electron preload + IPC + native SSE adapter. HTTP responses are
// fixtures; this does not test GGUF inference, a physical GPU, or AppImage packaging.
const assert=require('node:assert/strict'),path=require('node:path');
if(!process.versions.electron){
 const {spawn}=require('node:child_process'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(process.env.ELECTRON_EXECUTABLE||require('electron'),[__filename,'--no-sandbox','--disable-gpu'],{env,stdio:'inherit'});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
}else{
 const {app,BrowserWindow,ipcMain}=require('electron'),http=require('node:http'),fs=require('node:fs/promises'),os=require('node:os');
 const {NativeAI}=require('../electron/native-ai.cjs');
 (async()=>{let window,server,root;
  try{
   await app.whenReady();root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-ipc-stream-'));
   server=http.createServer((request,response)=>{request.resume();response.writeHead(200,{'Content-Type':'text/event-stream'});const first=Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'Zażółć '}}]})+'\n\n'),split=first.indexOf(Buffer.from('ż'))+1;response.write(first.subarray(0,split));const timers=[];timers.push(setTimeout(()=>response.write(first.subarray(split)),15));timers.push(setTimeout(()=>response.end('data: '+JSON.stringify({choices:[{delta:{content:'gęślą'},finish_reason:'stop'}],usage:{prompt_tokens:9,completion_tokens:4},timings:{predicted_per_second:24}})+'\n\n'),150));response.on('close',()=>timers.forEach(clearTimeout));});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({maxContext:2048})}});ai.endpoint='http://127.0.0.1:'+server.address().port;ai.key='fixture';ai.mode='cpu';ai.memory=async()=>{};ai.prepare=async()=>{ai.backend='cpu';ai.loadedId='known';ai.state.loaded=true;};
   ipcMain.handle('calendar-ai:complete',(event,id,request,requestId)=>ai.complete(id,request,chunk=>event.sender.send('calendar-ai:chunk',{...chunk,requestId})));
   ipcMain.handle('calendar-ai:cancel-generation',()=>ai.cancelGeneration());ipcMain.handle('calendar-ai:status',()=>ai.snapshot());
   await fs.writeFile(path.join(root,'index.html'),'<!doctype html><meta charset="utf-8"><title>IPC fixture</title>');
   window=new BrowserWindow({show:false,webPreferences:{preload:path.resolve(__dirname,'../electron/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
   await window.loadFile(path.join(root,'index.html'));
   const result=await window.webContents.executeJavaScript(`(async()=>{
    const request={messages:[{role:'user',content:'fixture'}],max_tokens:16},parts=[];let finished=false;
    const first=await window.calendarNativeAI.complete('known',request,chunk=>{if(finished)throw Error('Chunk after completion');parts.push(chunk.text);});finished=true;
    const count=parts.length;const second=await window.calendarNativeAI.complete('known',request,()=>{});
    let partial='',cancellation;const cancelled=window.calendarNativeAI.complete('known',request,chunk=>{partial+=chunk.text;cancellation??=window.calendarNativeAI.cancelGeneration();});
    let rejected=false;try{await cancelled;}catch{rejected=true;}await cancellation;
    return {first,second,parts,oldListenerUnchanged:count===parts.length,partial,rejected,status:await window.calendarNativeAI.status(),nodeExposed:typeof require!=='undefined'};
   })()`);
   assert.equal(result.nodeExposed,false);assert.deepEqual(result.parts,['Zażółć ','gęślą']);assert.equal(result.first.text,'Zażółć gęślą');assert.equal(result.first.usage.completion_tokens,4);assert.equal(result.oldListenerUnchanged,true);assert.equal(result.rejected,true);assert.equal(result.status.loaded,true);assert.equal(result.partial,'Zażółć ');
   console.log('PASS real Electron contextIsolation/sandbox IPC streaming, Unicode, per-request isolation and resident cancellation (SSE fixture; no model/GPU inference).');
  }finally{window?.destroy();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(root)await fs.rm(root,{recursive:true,force:true});}
 })().then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});
}
