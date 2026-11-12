import { findModel } from './modelRegistry';
import { assistantBackgroundEnabled,keepModelLoaded } from './assistantBackground';
import { gpuLayerPreference } from './modelGpuLayers';
import { recordDiagnosticAction } from './modelDiagnostics';
import type { Wllama } from '@wllama/wllama/esm/index.js';
import { backendGpuLayers,backendMode,backendStatus,desktopAI,updateBackend } from './nativeDesktopAI';
export type RuntimeEngine=Pick<Wllama,'exit'|'isMultithread'|'createChatCompletion'>;
export async function prepareNativeEngine(id:string,signal:AbortSignal,contextSize?:number):Promise<RuntimeEngine>{
  const bridge=desktopAI()!;
  const stop=()=>{void bridge.stop().catch(error=>recordDiagnosticAction('release-memory','error',error));};signal.addEventListener('abort',stop,{once:true});
  try{
    await bridge.configureResidency?.(assistantBackgroundEnabled(),keepModelLoaded());
    const model=findModel(id),layers=backendGpuLayers(model),automatic=gpuLayerPreference(model).mode==='auto';
    if(backendStatus().mode!==backendMode()||backendStatus().gpuLayers!==layers||backendStatus().automaticLayers!==automatic)updateBackend(await bridge.setMode(backendMode(),layers,automatic));
    const status=await bridge.prepare(id,contextSize);signal.throwIfAborted();if(!status.loaded)throw Error('native-not-loaded');updateBackend(status);
  }finally{signal.removeEventListener('abort',stop);}
  const engine={
    exit:async()=>{recordDiagnosticAction('release-memory','bridge-call');await bridge.stop();updateBackend({loaded:false,gpuActive:false,processAlive:false,stopping:false,shutdownError:undefined,contextApplied:undefined,contextUsed:undefined,ramBytes:undefined,vramBytes:undefined});},
    isMultithread:()=> (backendStatus().threads||1)>1,
    createChatCompletion:async(options:Record<string,unknown>)=>{
      const abort=options.abortSignal as AbortSignal;
      const stop=()=>{void (keepModelLoaded()&&bridge.cancelGeneration?bridge.cancelGeneration():bridge.stop()).catch(error=>recordDiagnosticAction('release-memory','error',error));};abort.addEventListener('abort',stop,{once:true});
      try{
        const {abortSignal,calendarRequestId,...request}=options;
        return (async function*(){
          const queue:{text?:string;reset?:boolean}[]=[];let wake=()=>{},done=false,error:unknown,received=false;
          const pending=bridge.complete(id,request,chunk=>{queue.push(chunk);wake();},calendarRequestId as string|undefined).then(result=>{updateBackend(result.backend);return result;},async failure=>{error=failure;try{updateBackend(await bridge.status());}catch{}return undefined;}).finally(()=>{done=true;wake();});
          try{
            while(!done||queue.length){
              if(!queue.length){await new Promise<void>(resolve=>{wake=resolve;});continue;}
              const chunk=queue.shift()!;if(chunk.reset){received=false;yield {choices:[],calendarReset:true};}
              else if(chunk.text){received=true;yield {choices:[{delta:{content:chunk.text}}]};}
            }
            const result=await pending;if(error)throw error;abort.throwIfAborted();
            if(result)yield {choices:[{delta:{content:received?'':result.text},finish_reason:result.finish}],usage:result.usage,timings:result.timings,calendarNative:{firstTokenMs:result.firstTokenMs,backend:result.backend}};
          }finally{abort.removeEventListener('abort',stop);}
        })();
      }catch(error){abort.removeEventListener('abort',stop);throw error;}
    },
  };
  return engine as unknown as RuntimeEngine;
}
