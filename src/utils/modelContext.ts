import type { ModelDescriptor } from './modelRegistry';
export type ContextPreference = {mode:'auto'} | {mode:'manual';tokens:number};
export type ModelMetadata = {architecture:string;contextLength?:number;blockCount?:number};
const settingsKey='calendar_model_context_v1',metadataKey='calendar_model_metadata_v1';
const listeners=new Set<()=>void>();let revision=0;
export const subscribeContext=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const contextRevision=()=>revision;
const notify=()=>{revision++;listeners.forEach(fn=>fn());};
export const modelContextKey=(model:ModelDescriptor)=>model.sha256?`sha256:${model.sha256}`:`${model.id}:${model.contextIdentity||model.revision}:${model.bytes}`;
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
function record(key:string):Record<string,any>{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
const preference=(p:any):ContextPreference=>p?.mode==='manual'&&positive(p.tokens)?{mode:'manual',tokens:p.tokens}:{mode:'auto'};
export const modelContextPreference=(model:ModelDescriptor)=>preference(record(settingsKey)[modelContextKey(model)]?.current);
export const previousContextPreference=(model:ModelDescriptor):ContextPreference|undefined=>{const value=record(settingsKey)[modelContextKey(model)]?.previous;return value?preference(value):undefined;};
export function modelMetadata(model:ModelDescriptor):ModelMetadata {
  const value=record(metadataKey)[modelContextKey(model)] || (model.external?model:{});
  return {architecture:typeof value.architecture==='string'&&/^[a-z0-9_]{1,64}$/.test(value.architecture)?value.architecture:model.architecture,...(positive(value.contextLength)?{contextLength:value.contextLength}:{}),...(positive(value.blockCount)&&value.blockCount<=1_000_000?{blockCount:value.blockCount}:{})};
}
export function cacheModelMetadata(model:ModelDescriptor,meta:ModelMetadata){
  const values=record(metadataKey),key=modelContextKey(model);
  const next={architecture:/^[a-z0-9_]{1,64}$/.test(meta.architecture)?meta.architecture:model.architecture,...(positive(meta.contextLength)?{contextLength:meta.contextLength}:{}),...(positive(meta.blockCount)&&meta.blockCount<=1_000_000?{blockCount:meta.blockCount}:{})};
  if(JSON.stringify(values[key])===JSON.stringify(next))return;
  try{localStorage.setItem(metadataKey,JSON.stringify({...Object.fromEntries(Object.entries(values).slice(-255)),[key]:next}));notify();}catch{/* Metadata can remain unknown when storage is unavailable. */}
}
export function contextPlan(model:ModelDescriptor,pref=modelContextPreference(model),availableBytes?:number,backendLimit=2147483647){
  const safeDefault=Math.min(2048,positive(model.maxContext)?model.maxContext:2048);
  const meta=modelMetadata(model),max=Math.min(meta.contextLength||safeDefault,positive(backendLimit)?backendLimit:2147483647),min=Math.min(32,max);
  // A conservative default, never the declared maximum or the whole system RAM.
  // Unknown KV layouts do not justify extrapolating a large allocation.
  const memoryKnown=positive(availableBytes);
  const pressured=memoryKnown&&Math.max(0,availableBytes-model.bytes)*0.25<256*1048576;
  const automatic=Math.min(max,pressured?512:safeDefault);
  if(pref.mode==='manual'&&(!Number.isSafeInteger(pref.tokens)||pref.tokens<min||pref.tokens>max))throw Error('model-context-range');
  return {min,max,requested:pref.mode==='manual'?pref.tokens:automatic,modelMax:meta.contextLength,memoryKnown,mode:pref.mode};
}
export function saveContextPreference(model:ModelDescriptor,next:ContextPreference){
  if(next.mode!=='auto'&&next.mode!=='manual')throw Error('model-context-range');
  contextPlan(model,next);
  const values=record(settingsKey),key=modelContextKey(model),previous=modelContextPreference(model);
  if(JSON.stringify(previous)===JSON.stringify(next))return;
  localStorage.setItem(settingsKey,JSON.stringify({...values,[key]:{current:next,previous}}));notify();
}
export const contextSliderValue=(tokens:number,min:number,max:number)=>max===min?0:Math.round(1000*Math.log(tokens/min)/Math.log(max/min));
export const contextSliderTokens=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(min*(max/min)**(value/1000))));
