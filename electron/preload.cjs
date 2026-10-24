const {contextBridge,ipcRenderer}=require('electron');
// No IPC primitives, filesystem paths, keys or process handles cross the bridge.
contextBridge.exposeInMainWorld('calendarNativeAI',{
  info:id=>ipcRenderer.invoke('calendar-ai:model-info',id),
  begin:id=>ipcRenderer.invoke('calendar-ai:upload-begin',id),
  write:(token,chunk)=>ipcRenderer.invoke('calendar-ai:upload-write',token,chunk),
  finish:token=>ipcRenderer.invoke('calendar-ai:upload-finish',token),
  abortUpload:token=>ipcRenderer.invoke('calendar-ai:upload-abort',token),
  remove:id=>ipcRenderer.invoke('calendar-ai:model-remove',id),
  prepare:id=>ipcRenderer.invoke('calendar-ai:prepare',id),
  complete:(id,request)=>ipcRenderer.invoke('calendar-ai:complete',id,request),
  stop:()=>ipcRenderer.invoke('calendar-ai:stop'),
  setMode:mode=>ipcRenderer.invoke('calendar-ai:mode',mode),
  status:()=>ipcRenderer.invoke('calendar-ai:status'),
});
