import { recordDiagnosticAction } from './modelDiagnostics';
import type { Wllama } from '@wllama/wllama/esm/index.js';
import { backendMode,backendStatus,desktopAI,updateBackend } from './nativeDesktopAI';
export type RuntimeEngine=Pick<Wllama,'exit'|'isMultithread'|'createChatCompletion'>;
export async function prepareNativeEngine(id:string,signal:AbortSignal):Promise<RuntimeEngine>{
  const bridge=desktopAI()!;
  const stop=()=>{void bridge.stop().catch(error=>recordDiagnosticAction('release-memory','error',error));};signal.addEventListener('abort',stop,{once:true});
  try{
    if(backendStatus().mode!==backendMode())await bridge.setMode(backendMode());
    const status=await bridge.prepare(id);signal.throwIfAborted();if(!status.loaded)throw Error('native-not-loaded');updateBackend(status);
  }finally{signal.removeEventListener('abort',stop);}
  const engine={
    exit:async()=>{recordDiagnosticAction('release-memory','bridge-call');await bridge.stop();updateBackend({loaded:false,gpuActive:false,ramBytes:undefined,vramBytes:undefined});},
    isMultithread:()=> (backendStatus().threads||1)>1,
    createChatCompletion:async(options:Record<string,unknown>)=>{
      const abort=options.abortSignal as AbortSignal;
      const stop=()=>{void bridge.stop().catch(error=>recordDiagnosticAction('release-memory','error',error));};abort.addEventListener('abort',stop,{once:true});
      try{
        const {abortSignal,...request}=options;
        const result=await bridge.complete(id,request);abort.throwIfAborted();updateBackend(result.backend);
        return (async function*(){yield {choices:[{delta:{content:result.text},finish_reason:result.finish}],usage:result.usage,timings:result.timings,calendarNative:{firstTokenMs:result.firstTokenMs,backend:result.backend}};})();
      }finally{abort.removeEventListener('abort',stop);}
    },
  };
  return engine as unknown as RuntimeEngine;
}
