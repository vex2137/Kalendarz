import { androidAI } from './nativeAndroidAI';
export type BackendMode = 'auto'|'gpu'|'cpu';
export interface BackendInfo {
  backend:'cpu-native'|'vulkan'|'cuda'|'metal'|'cpu-wasm'; mode:BackendMode; available:boolean;
  loaded:boolean;gpuActive:boolean;modeChanging?:boolean;gpuLayers?:number;system?:string;cpuArchitecture?:string;packagedBackends?:string[];availableBackends?:string[];vulkanFeatureVersion?:number;vulkanHardwareLevel?:number;deviceName?:string;offloadedLayers?:number;
  fallbackReason?:string;threads?:number;ramBytes?:number;vramBytes?:number;memoryScope?:string;
  errorCode?:string;modelId?:string;modelName?:string;loadMs?:number;tokensPerSecond?:number;
  gpuAttempt?:{arguments?:Record<string,string>;stage:string;status:string;requestedDevice?:string;requestedLayers:number;contextLength:number;offloadedLayersObserved:number;code?:string;nativeCode?:string;exceptionType?:string;message?:string;exitCode?:number;healthHttpStatus?:number;nativeLog:string;stages:{stage:string;elapsedMs:number}[]};
  nativeRuntime?:{version:string;commit:string;abi:string;vulkanLinkage:string};
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
  stop():Promise<void>;setMode(mode:BackendMode,gpuLayers?:number):Promise<BackendInfo>;status():Promise<BackendInfo>;
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
export function updateBackend(next:Partial<BackendInfo>){status={...status,...('available' in next?{deviceName:undefined,offloadedLayers:undefined,fallbackReason:undefined,ramBytes:undefined,vramBytes:undefined,errorCode:undefined,modelId:undefined,modelName:undefined,loadMs:undefined,tokensPerSecond:undefined}:{}),...next};listeners.forEach(fn=>fn());}
const key='calendar_ai_backend_mode_v1';
export function backendMode():BackendMode {try{const v=localStorage.getItem(key);return v==='gpu'||v==='cpu'?v:'auto';}catch{return'auto';}}
const layersKey='calendar_ai_gpu_layers_v1';
export function backendGpuLayers():number {try{const n=Number(localStorage.getItem(layersKey));return Number.isInteger(n)&&n>=1&&n<=999?n:999;}catch{return 999;}}
export async function applyBackendMode(mode:BackendMode,layers=backendGpuLayers()){
  if(!['auto','gpu','cpu'].includes(mode)||!Number.isInteger(layers)||layers<1||layers>999)throw Error('model-input');
  const bridge=desktopAI(),previous=backendMode(),previousLayers=backendGpuLayers();
  if(mode==='gpu'&&!bridge)throw Error('model-gpu-unavailable');
  // Check persistent storage before changing the native engine. Roll back both
  // fields and native policy if a write or bridge acknowledgement fails.
  try{
    localStorage.setItem(key,mode);localStorage.setItem(layersKey,String(layers));
    if(bridge)updateBackend(await bridge.setMode(mode,layers));
    updateBackend({mode,gpuLayers:layers});
  }catch(error){
    try{localStorage.setItem(key,previous);localStorage.setItem(layersKey,String(previousLayers));}catch{}
    if(bridge)try{updateBackend(await bridge.setMode(previous,previousLayers));}catch{updateBackend({errorCode:'model-mode-rollback'});}
    throw error;
  }
}
export async function ensureNativeModel(id:string,blob:Blob,signal:AbortSignal,progress?:(bytes:number)=>void){
  const bridge=desktopAI();if(!bridge)return false;
  signal.throwIfAborted();const upload=await bridge.begin(id);if(upload.exists)return true;
  const token=upload.token!;
  try{for(let offset=0, size=bridge.platform==='android'?256*1024:4*1024*1024;offset<blob.size;offset+=size){signal.throwIfAborted();const chunk=new Uint8Array(await blob.slice(offset,offset+size).arrayBuffer());await bridge.write(token,chunk);progress?.(Math.min(blob.size,offset+chunk.byteLength));}signal.throwIfAborted();await bridge.finish(token);return true;}
  finally{await bridge.abortUpload(token).catch(()=>{});}
}
