const {contextBridge,ipcRenderer}=require('electron');
// Expose only named operations; normalize public error codes across Electron IPC.
const invoke=(name,...args)=>ipcRenderer.invoke('calendar-ai:'+name,...args).catch(error=>{
  const code=error.message.match(/\b(?:model|native)-[a-z-]+\b/)?.[0];
  throw Error(code||'model-inference');
});
contextBridge.exposeInMainWorld('calendarNativeAI',{
  info:id=>invoke('model-info',id),
  begin:id=>invoke('upload-begin',id),
  write:(token,chunk)=>invoke('upload-write',token,chunk),
  finish:token=>invoke('upload-finish',token),
  abortUpload:token=>invoke('upload-abort',token),
  remove:id=>invoke('model-remove',id),
  prepare:id=>invoke('prepare',id),
  complete:(id,request)=>invoke('complete',id,request),
  stop:()=>invoke('stop'),
  setMode:mode=>invoke('mode',mode),
  status:()=>invoke('status'),
  folders:()=>invoke('folders-list'),
  addFolder:()=>invoke('folders-add'),
  refreshFolders:()=>invoke('folders-refresh'),
  removeFolder:id=>invoke('folders-remove',id),
});
