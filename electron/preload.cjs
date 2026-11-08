const {contextBridge,ipcRenderer}=require('electron');
// Expose only named operations; normalize public error codes across Electron IPC.
const invoke=(name,...args)=>ipcRenderer.invoke('calendar-ai:'+name,...args).catch(error=>{
  const code=error.message.match(/\b(?:model|native)-[a-z-]+\b/)?.[0];
  throw Error(code||'model-inference');
});
contextBridge.exposeInMainWorld('calendarNativeAI',{
  registerImported:descriptor=>invoke('register-imported',descriptor),
  info:id=>invoke('model-info',id),
  begin:id=>invoke('upload-begin',id),
  write:(token,chunk)=>invoke('upload-write',token,chunk),
  finish:token=>invoke('upload-finish',token),
  abortUpload:token=>invoke('upload-abort',token),
  remove:id=>invoke('model-remove',id),
  prepare:(id,contextSize)=>invoke('prepare',id,contextSize),
  complete:async(id,request,onChunk,clientId)=>{const requestId=clientId||crypto.randomUUID(),listener=(_event,chunk)=>{if(chunk.requestId===requestId)onChunk?.(chunk);};ipcRenderer.on('calendar-ai:chunk',listener);try{return await invoke('complete',id,request,requestId);}finally{ipcRenderer.removeListener('calendar-ai:chunk',listener);}},
  cancelGeneration:()=>invoke('cancel-generation'),
  stop:()=>invoke('stop'),
  setMode:(mode,layers,automatic)=>invoke('mode',mode,layers,automatic),
  status:()=>invoke('status'),
  forgetModel:id=>invoke('folders-forget',id),
  folders:()=>invoke('folders-list'),
  addFolder:()=>invoke('folders-add'),
  refreshFolders:()=>invoke('folders-refresh'),
  removeFolder:id=>invoke('folders-remove',id),
});
