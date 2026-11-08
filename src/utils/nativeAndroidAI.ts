import { Capacitor, registerPlugin } from '@capacitor/core';
import { updateBackend, type DesktopBridge, type BackendMode } from './nativeDesktopAI';
import { findModel } from './modelRegistry';
import { BUILD_INFO } from './buildInfo';
const foldersPlugin=registerPlugin<Record<string,(options?:unknown)=>Promise<any>>>('CalendarModelFolders');
const plugin = registerPlugin<Record<string,(options?:unknown)=>Promise<any>>>('CalendarNativeAI');
const model = (id:string) => { const descriptor=findModel(id); if(descriptor.id!==id)throw Error('model-unknown'); return descriptor; };
const unsupported=async()=>{throw Error('model-desktop-only');};
// The bridge transfers bounded chunks once. Native inference reads its private file
// directly; prompts and tokens do not pass through a WebView WASM heap.
const bridge:DesktopBridge={
  platform:'android',
  folders:()=>foldersPlugin.list(),addFolder:()=>foldersPlugin.add(),refreshFolders:()=>foldersPlugin.refresh(),removeFolder:id=>foldersPlugin.remove({id}),forgetModel:id=>foldersPlugin.forget({id}),relinkModel:id=>foldersPlugin.relink({id}),
  info:id=>plugin.info({model:model(id)}),begin:id=>plugin.begin({model:model(id)}),
  write:async(token,chunk)=>{let binary='';for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));return (await plugin.write({token,data:btoa(binary)})).bytes;},
  finish:token=>plugin.finish({token}),abortUpload:token=>plugin.abortUpload({token}),remove:id=>plugin.remove({model:model(id)}),
  prepare:(id,contextSize)=>plugin.prepare({model:model(id),contextSize}),
  generation:()=>plugin.generation(),
  complete:async(id,request,onChunk,clientId)=>{
    const requestId=clientId||crypto.randomUUID();
    const listener=onChunk?await (plugin as any).addListener('completionChunk',(chunk:any)=>{if(chunk.requestId===requestId)onChunk(chunk);}):undefined;
    try{return await plugin.complete({model:model(id),request,requestId});}finally{await listener?.remove();}
  },
  configureResidency:async(background,keepLoaded)=>{await plugin.configureResidency({background,keepLoaded});},
  cancelGeneration:async()=>{await plugin.cancelGeneration();},
  stop:()=>plugin.stop(),setMode:(mode:BackendMode,gpuLayers?:number,automaticLayers?:boolean)=>plugin.setMode({mode,gpuLayers,automaticLayers}),status:()=>plugin.status(),
};
let available=false;
export const androidAIReady = Capacitor.getPlatform()==='android' && BUILD_INFO.androidNative===true && Capacitor.isPluginAvailable('CalendarNativeAI')
  ? plugin.status().then(status=>{available=status.available===true;if(available){updateBackend(status);void (plugin as any).addListener('memoryPressure',()=>window.dispatchEvent(new Event('calendar-memory-pressure')));}}).catch(()=>{}) : Promise.resolve();
export const androidAI=()=>available?bridge:undefined;
