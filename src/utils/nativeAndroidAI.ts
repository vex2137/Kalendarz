import { Capacitor, registerPlugin } from '@capacitor/core';
import { updateBackend, type DesktopBridge, type BackendMode } from './nativeDesktopAI';
import { findModel } from './modelRegistry';
import { BUILD_INFO } from './buildInfo';
const plugin = registerPlugin<Record<string,(options?:unknown)=>Promise<any>>>('CalendarNativeAI');
const model = (id:string) => { const descriptor=findModel(id); if(descriptor.id!==id||descriptor.external)throw Error('model-unknown'); return descriptor; };
const unsupported=async()=>{throw Error('model-desktop-only');};
// The bridge transfers bounded chunks once. Native inference reads its private file
// directly; prompts and tokens do not pass through a WebView WASM heap.
const bridge:DesktopBridge={
  platform:'android',
  folders:unsupported,addFolder:unsupported,refreshFolders:unsupported,removeFolder:unsupported,
  info:id=>plugin.info({model:model(id)}),begin:id=>plugin.begin({model:model(id)}),
  write:async(token,chunk)=>{let binary='';for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));return (await plugin.write({token,data:btoa(binary)})).bytes;},
  finish:token=>plugin.finish({token}),abortUpload:token=>plugin.abortUpload({token}),remove:id=>plugin.remove({model:model(id)}),
  prepare:id=>plugin.prepare({model:model(id)}),complete:(id,request)=>plugin.complete({model:model(id),request}),
  stop:()=>plugin.stop(),setMode:(mode:BackendMode)=>plugin.setMode({mode}),status:()=>plugin.status(),
};
let available=false;
export const androidAIReady = Capacitor.getPlatform()==='android' && BUILD_INFO.androidNative===true && Capacitor.isPluginAvailable('CalendarNativeAI')
  ? plugin.status().then(status=>{available=status.available===true;if(available)updateBackend(status);}).catch(()=>{}) : Promise.resolve();
export const androidAI=()=>available?bridge:undefined;
