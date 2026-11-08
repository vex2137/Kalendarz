import { activeModel, type ModelDescriptor } from './modelRegistry';
import { modelContextKey, modelMetadata } from './modelContext';

const key='calendar_model_gpu_layers_v1';
type Preference={mode:'auto'}|{mode:'manual';layers:number};
function saved():{legacyAdopted?:boolean;models:Record<string,Preference>}{
  try{const v=JSON.parse(localStorage.getItem(key)||'{}');return {legacyAdopted:v.legacyAdopted,models:v.models&&typeof v.models==='object'&&!Array.isArray(v.models)?v.models:{}};}catch{return {models:{}};}
}
export function gpuLayerBounds(model=activeModel()){
  const blocks=modelMetadata(model).blockCount;
  // llama.cpp includes the output layer. Unknown metadata permits one layer,
  // never an invented block count or the legacy "all layers" sentinel.
  return {blocks,max:blocks===undefined?1:blocks+1};
}
export function gpuLayerPreference(model=activeModel()):Preference {
  const data=saved(),id=modelContextKey(model);
  if(!data.legacyAdopted){
    let legacy=NaN;try{legacy=Number(localStorage.getItem('calendar_ai_gpu_layers_v1'));}catch{}
    if(!data.models[id]&&Number.isInteger(legacy)&&legacy>0&&legacy<999)data.models[id]={mode:'manual',layers:legacy};
    data.legacyAdopted=true;try{localStorage.setItem(key,JSON.stringify(data));}catch{}
  }
  const p=data.models[id];
  if(p?.mode!=='manual'||!Number.isSafeInteger(p.layers)||p.layers<1)return {mode:'auto'};
  const bounds=gpuLayerBounds(model),layers=Math.min(p.layers,bounds.max);
  if(bounds.blocks!==undefined&&layers!==p.layers){data.models[id]={mode:'manual',layers};try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
  return {mode:'manual',layers};
}
export function gpuLayerLimit(model=activeModel()){
  const p=gpuLayerPreference(model);return p.mode==='manual'?p.layers:gpuLayerBounds(model).max;
}
export function saveGpuLayerPreference(model:ModelDescriptor,value:number|'auto'){
  if(value!=='auto'&&(!Number.isSafeInteger(value)||value<1||value>gpuLayerBounds(model).max))throw Error('model-input');
  const data=saved();data.legacyAdopted=true;data.models[modelContextKey(model)]=value==='auto'?{mode:'auto'}:{mode:'manual',layers:value};
  localStorage.setItem(key,JSON.stringify(data));
}
export const gpuLayerStorageKey=key;
