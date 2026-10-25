import { androidAI } from './nativeAndroidAI';
export type BackendMode = 'auto'|'gpu'|'cpu';
export interface BackendInfo {
  backend:'cpu-native'|'vulkan'|'cuda'|'metal'|'cpu-wasm'; mode:BackendMode; available:boolean;
  loaded:boolean;gpuActive:boolean;deviceName?:string;offloadedLayers?:number;
  fallbackReason?:string;threads?:number;ramBytes?:number;vramBytes?:number;memoryScope?:string;
  errorCode?:string;modelId?:string;modelName?:string;loadMs?:number;tokensPerSecond?:number;
  gpuDevices?:{id:string;name:string;totalBytes?:number;freeBytes?:number}[];
}
interface NativeResult {text:string;finish:string;usage:{prompt_tokens?:number;completion_tokens?:number};timings:Record<string,number>;firstTokenMs?:number;backend:BackendInfo}
export interface DesktopBridge {
  platform?: 'android';
  registerImported?(model:import('./modelRegistry').ModelDescriptor):Promise<void>;
  folders():Promise<ModelFolderSnapshot>;addFolder():Promise<ModelFolderSnapshot>;
  refreshFolders():Promise<ModelFolderSnapshot>;removeFolder(id:string):Promise<ModelFolderSnapshot>;
  info(id:string):Promise<{installed:boolean;bytes?:number}>;
  begin(id:string):Promise<{exists?:boolean;token?:string}>;
  write(token:string,chunk:Uint8Array):Promise<number>;finish(token:string):Promise<{installed:boolean}>;
  abortUpload(token:string):Promise<void>;remove(id:string):Promise<void>;
  prepare(id:string):Promise<BackendInfo>;complete(id:string,request:unknown):Promise<NativeResult>;
  stop():Promise<void>;setMode(mode:BackendMode):Promise<BackendInfo>;status():Promise<BackendInfo>;
}
export interface ModelFolderSnapshot {
  folders:{id:string;path:string}[];
  models:(import('./modelRegistry').ModelDescriptor&{folderIds:string[]})[];
  warnings:{folderId:string;file?:string;code:string}[];
}
declare global {interface Window {calendarNativeAI?:DesktopBridge}}
export const desktopAI = () => typeof window!=='undefined'?window.calendarNativeAI || androidAI():undefined;
let status:BackendInfo={backend:'cpu-wasm',mode:'auto',available:false,loaded:false,gpuActive:false};
const listeners=new Set<()=>void>();
export const backendStatus=()=>status;
export const subscribeBackend=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function updateBackend(next:Partial<BackendInfo>){status={...status,...next};listeners.forEach(fn=>fn());}
const key='calendar_ai_backend_mode_v1';
export function backendMode():BackendMode {try{const v=localStorage.getItem(key);return v==='gpu'||v==='cpu'?v:'auto';}catch{return'auto';}}
export async function applyBackendMode(mode:BackendMode){if(!['auto','gpu','cpu'].includes(mode))throw Error('model-input');if(desktopAI())updateBackend(await desktopAI()!.setMode(mode));localStorage.setItem(key,mode);updateBackend({mode});}
export async function ensureNativeModel(id:string,blob:Blob,signal:AbortSignal,progress?:(bytes:number)=>void){
  const bridge=desktopAI();if(!bridge)return false;
  signal.throwIfAborted();const upload=await bridge.begin(id);if(upload.exists)return true;
  const token=upload.token!;
  try{for(let offset=0, size=bridge.platform==='android'?256*1024:4*1024*1024;offset<blob.size;offset+=size){signal.throwIfAborted();const chunk=new Uint8Array(await blob.slice(offset,offset+size).arrayBuffer());await bridge.write(token,chunk);progress?.(Math.min(blob.size,offset+chunk.byteLength));}signal.throwIfAborted();await bridge.finish(token);return true;}
  finally{await bridge.abortUpload(token).catch(()=>{});}
}
