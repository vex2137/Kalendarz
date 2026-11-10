import { activeModel, type ModelDescriptor } from './modelRegistry';
import { gpuLayerLimit, gpuLayerPreference, gpuLayerStorageKey, saveGpuLayerPreference } from './modelGpuLayers';
import { androidAI } from './nativeAndroidAI';
export type BackendMode = 'auto'|'gpu'|'cpu';
export interface BackendInfo {
  backend:'cpu-native'|'vulkan'|'cuda'|'metal'|'cpu-wasm'; mode:BackendMode; available:boolean;
  contextLimit?:number; availableMemoryBytes?:number; contextRequested?:number; contextApplied?:number; contextUsed?:number;
  loaded:boolean;gpuActive:boolean;automaticLayers?:boolean;modeChanging?:boolean;gpuLayers?:number;system?:string;cpuArchitecture?:string;packagedBackends?:string[];availableBackends?:string[];vulkanFeatureVersion?:number;vulkanHardwareLevel?:number;deviceName?:string;offloadedLayers?:number;
  fallbackReason?:string;threads?:number;ramBytes?:number;vramBytes?:number;memoryScope?:string;
  processAlive?:boolean;stopping?:boolean;shutdownError?:string;
  inference?:{status:string;stage:string;backend:string;httpStatus?:number;completionTokens?:number;textCharacters?:number;finishReason?:string;exceptionType?:string;code?:string};
  errorCode?:string;modelId?:string;modelName?:string;loadMs?:number;tokensPerSecond?:number;
  nativeAttempts?:{backend:string;binary:string;stage:string;status:string;requestedLayers:number;effectiveLayers?:number;estimatedVramBytes?:number;availableVramBytes?:number;reserveBytes?:number;kvCacheBytes?:number;backendOverheadBytes?:number;estimateKind?:string;layerMetadataKnown?:boolean;contextLength?:number;offloadedLayers:number;stderr:string;code?:string;reason?:string;nativeCode?:string;exitCode?:number|null;signal?:string|null;healthHttpStatus?:number}[];
  gpuAttempt?:{arguments?:Record<string,string>;stage:string;status:string;requestedDevice?:string;requestedLayers:number;contextLength:number;offloadedLayersObserved:number;code?:string;nativeCode?:string;exceptionType?:string;message?:string;exitCode?:number;healthHttpStatus?:number;nativeLog:string;stages:{stage:string;elapsedMs:number}[]};
  nativeRuntime?:{version:string;commit:string;abi:string;vulkanLinkage:string;binaryPresent?:boolean;binaryExecutable?:boolean;supportedAbis?:string[]};
  gpuDevices?:{id:string;name:string;totalBytes?:number;freeBytes?:number}[];
}
interface NativeResult {text:string;finish:string;usage:{prompt_tokens?:number;completion_tokens?:number};timings:Record<string,number>;firstTokenMs?:number;backend:BackendInfo}
export interface DesktopBridge {
  platform?: 'android';
  registerImported?(model:import('./modelRegistry').ModelDescriptor):Promise<void>;
  relinkModel?(id:string):Promise<ModelFolderSnapshot>;
  forgetModel?(id:string):Promise<ModelFolderSnapshot>;
  folders():Promise<ModelFolderSnapshot>;addFolder():Promise<ModelFolderSnapshot>;
  refreshFolders():Promise<ModelFolderSnapshot>;removeFolder(id:string):Promise<ModelFolderSnapshot>;
  info(id:string):Promise<{installed:boolean;verified?:boolean;bytes?:number}>;
  begin(id:string):Promise<{exists?:boolean;token?:string}>;
  write(token:string,chunk:Uint8Array):Promise<number>;finish(token:string):Promise<{installed:boolean}>;
  abortUpload(token:string):Promise<void>;remove(id:string):Promise<void>;
  prepare(id:string,contextSize?:number):Promise<BackendInfo>;complete(id:string,request:unknown,onChunk?:(chunk:{text?:string;reset?:boolean})=>void,requestId?:string):Promise<NativeResult>;
  generation?():Promise<{id?:string;text:string;status:'running'|'complete'|'cancelled'|'error';modelId?:string;structured?:boolean}>;
  configureResidency?(background:boolean,keepLoaded:boolean):Promise<void>;
  cancelGeneration?():Promise<void>;
  stop():Promise<void>;setMode(mode:BackendMode,gpuLayers?:number,automaticLayers?:boolean):Promise<BackendInfo>;status():Promise<BackendInfo>;
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
export function updateBackend(next:Partial<BackendInfo>){status={...status,...('available' in next?{deviceName:undefined,offloadedLayers:undefined,contextRequested:undefined,contextApplied:undefined,contextUsed:undefined,fallbackReason:undefined,ramBytes:undefined,vramBytes:undefined,errorCode:undefined,modelId:undefined,modelName:undefined,loadMs:undefined,tokensPerSecond:undefined}:{}),...next};listeners.forEach(fn=>fn());}
const key='calendar_ai_backend_mode_v1';
export function backendMode():BackendMode {try{const v=localStorage.getItem(key);return v==='gpu'||v==='cpu'?v:'auto';}catch{return'auto';}}
const layersKey='calendar_ai_gpu_layers_v1';
export const backendGpuLayers=(model=activeModel())=>gpuLayerLimit(model);
export async function applyBackendMode(mode:BackendMode,layers?:number|'auto',model:ModelDescriptor=activeModel()){
  if(!['auto','gpu','cpu'].includes(mode))throw Error('model-input');
  const bridge=desktopAI(),previous=backendMode(),previousLayers=backendGpuLayers(model),previousAuto=gpuLayerPreference(model).mode==='auto';
  if(mode==='gpu'&&!bridge)throw Error('model-gpu-unavailable');
  const oldPreferences=localStorage.getItem(gpuLayerStorageKey),oldLegacy=localStorage.getItem(layersKey);
  try{
    if(layers!==undefined)saveGpuLayerPreference(model,layers);
    const limit=backendGpuLayers(model),automatic=gpuLayerPreference(model).mode==='auto';
    localStorage.setItem(key,mode);localStorage.setItem(layersKey,String(limit));
    if(bridge)updateBackend(await bridge.setMode(mode,limit,automatic));
    updateBackend({mode,gpuLayers:limit,automaticLayers:automatic});
  }catch(error){
    try{localStorage.setItem(key,previous);if(oldPreferences===null)localStorage.removeItem(gpuLayerStorageKey);else localStorage.setItem(gpuLayerStorageKey,oldPreferences);if(oldLegacy===null)localStorage.removeItem(layersKey);else localStorage.setItem(layersKey,oldLegacy);}catch{}
    if(bridge)try{updateBackend(await bridge.setMode(previous,previousLayers,previousAuto));}catch{updateBackend({errorCode:'model-mode-rollback'});}
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
