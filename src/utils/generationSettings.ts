import type { ModelDescriptor } from './modelRegistry';
import { modelContextKey } from './modelContext';
import { completionTokenLimit } from './inferencePolicy';

export const MAX_OUTPUT_TOKENS=4096;
type Preference={mode:'auto'}|{mode:'manual';tokens:number};
const key='calendar_model_generation_v1';
function settings():Record<string,Preference>{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
export function generationPreference(model:ModelDescriptor):Preference {
 const p=settings()[modelContextKey(model)];return p?.mode==='manual'&&Number.isInteger(p.tokens)&&p.tokens>=1&&p.tokens<=MAX_OUTPUT_TOKENS?p:{mode:'auto'};
}
export function saveGenerationPreference(model:ModelDescriptor,p:Preference){
 if(p.mode!=='auto'&&(p.mode!=='manual'||!Number.isInteger(p.tokens)||p.tokens<1||p.tokens>MAX_OUTPUT_TOKENS))throw Error('model-output-range');
 localStorage.setItem(key,JSON.stringify({...settings(),[modelContextKey(model)]:p}));
}
export function generationPlan(model:ModelDescriptor,prompt:string,structured:boolean,override:number|undefined,context:number,messages:{content:string}[]){
 const pref=generationPreference(model);
 const words=prompt.match(/\b(\d{2,4})\s*[-–]\s*(\d{2,4})\s*(?:words|słów|slow)\b/iu);
 const automatic=words?Math.min(MAX_OUTPUT_TOKENS,Math.ceil(Number(words[2])*2)):1024;
 const requested=override??(structured?completionTokenLimit(model.id,prompt,true):pref.mode==='manual'?pref.tokens:automatic);
 if(!Number.isInteger(requested)||requested<1||requested>MAX_OUTPUT_TOKENS)throw Error('model-output-range');
 // Explicitly approximate until the backend reports actual usage. Reserve room
 // for template tokens; never describe this estimate as measured prompt usage.
 const estimatedInputTokens=messages.reduce((n,m)=>n+Math.ceil(new TextEncoder().encode(m.content).length/3)+16,0)+32;
 const available=Math.floor(context)-estimatedInputTokens-64;
 if(available<1)throw Error('model-context-budget');
 return {maxOutputTokens:Math.min(requested,available),requestedOutputTokens:requested,estimatedInputTokens,contextLimited:requested>available,outputLimitSource:override!==undefined?'override':structured?'structured':pref.mode==='manual'?'manual':'auto'} as const;
}
