import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppLanguage } from '../utils/i18n';
import type { ModelDescriptor } from '../utils/modelRegistry';
import { backendStatus, subscribeBackend } from '../utils/nativeDesktopAI';
import { changeLocalContext } from '../utils/localModelRuntime';
import { contextPlan, contextRevision, contextSliderTokens, contextSliderValue, modelContextPreference, modelMetadata, previousContextPreference, subscribeContext, type ContextPreference } from '../utils/modelContext';
import { modelSettingsText } from '../utils/modelSettingsText';

export function ModelContextSettings({model,language,busy}:{model:ModelDescriptor;language:AppLanguage;busy:boolean}){
 useSyncExternalStore(subscribeContext,contextRevision);
 const backend=useSyncExternalStore(subscribeBackend,backendStatus),text=modelSettingsText(language),saved=modelContextPreference(model),encoded=JSON.stringify(saved);
 const [mode,setMode]=useState(saved.mode),[tokens,setTokens]=useState(String(saved.mode==='manual'?saved.tokens:contextPlan(model,{mode:'auto'}).requested));
 const [message,setMessage]=useState<string>(),[saving,setSaving]=useState(false);
 useEffect(()=>{const pref=modelContextPreference(model);setMode(pref.mode);setTokens(String(pref.mode==='manual'?pref.tokens:contextPlan(model,{mode:'auto'}).requested));},[model.id,encoded]);
 const auto=contextPlan(model,{mode:'auto'},backend.availableMemoryBytes,backend.contextLimit);
 const draft:ContextPreference=mode==='auto'?{mode:'auto'}:{mode:'manual',tokens:Number(tokens)};
 let invalid=false;try{contextPlan(model,draft,backend.availableMemoryBytes,backend.contextLimit);}catch{invalid=true;}
 let configured:number|undefined;try{configured=contextPlan(model,saved,backend.availableMemoryBytes,backend.contextLimit).requested;}catch{}
 const apply=async(pref:ContextPreference)=>{setSaving(true);setMessage(undefined);try{await changeLocalContext(pref);setMessage(text.reload);}catch(error){setMessage(error instanceof Error&&error.message==='model-busy'?text.busy:text.savedError);}finally{setSaving(false);}};
 const loaded=backend.loaded&&backend.modelId===model.id;
 if(loaded&&saved.mode==='auto'&&backend.contextRequested!==undefined)configured=backend.contextRequested;
 const autoDisplayed=loaded&&saved.mode==='auto'?backend.contextRequested??auto.requested:auto.requested;
 const previous=previousContextPreference(model),meta=modelMetadata(model);
 return <section data-testid="model-context-settings" className="theme-border border rounded-xl p-3 space-y-2 text-xs min-w-0">
  <h4 className="font-semibold break-words [overflow-wrap:anywhere]">{text.context} · {model.name}</h4>
  <label className="inline-flex gap-2 items-center"><input type="checkbox" checked={mode==='auto'} disabled={busy||saving} onChange={e=>setMode(e.target.checked?'auto':'manual')}/>{text.auto}</label>
  <div className="flex flex-wrap items-center gap-2"><input aria-label={text.slider} type="range" aria-valuetext={String(mode==='auto'?autoDisplayed:tokens)} min="0" max="1000" step="1" className="min-w-0 flex-1" disabled={busy||saving||mode==='auto'} value={contextSliderValue(Math.min(auto.max,Math.max(auto.min,mode==='auto'?autoDisplayed:Number(tokens)||auto.min)),auto.min,auto.max)} onChange={e=>setTokens(String(contextSliderTokens(Number(e.target.value),auto.min,auto.max)))}/>
   <label className="inline-flex flex-wrap items-center gap-2">{text.tokens}<input aria-label={text.tokens} type="number" min={auto.min} max={auto.max} step="1" value={mode==='auto'?autoDisplayed:tokens} onChange={e=>setTokens(e.target.value)} disabled={busy||saving||mode==='auto'} className="theme-input rounded p-2 w-28"/></label></div>
  <p>{auto.min}–{auto.max} · {text.modelMax}: {meta.contextLength??text.unknown}</p>
  {!meta.contextLength&&<p className="theme-muted">{text.inspect}</p>}
  {invalid&&<p role="alert">{text.range}</p>}
  <div className="flex flex-wrap gap-2"><button type="button" disabled={invalid||busy||saving} className="ai-action rounded-lg p-2 min-h-10 disabled:opacity-50" onClick={()=>void apply(draft)}>{text.apply}</button>{previous&&<button type="button" disabled={busy||saving} className="ai-action rounded-lg p-2" onClick={()=>void apply(previous)}>{text.revert}</button>}</div>
  {busy&&<p role="status">{text.busy}</p>}
  <p data-testid="context-applied">{text.saved}: {configured??text.unknown} · {text.applied}: {loaded?backend.contextApplied??text.unknown:text.unknown} · {text.used}: {loaded?backend.contextUsed??text.unknown:text.unknown}</p>
  {loaded&&backend.contextApplied===undefined&&<p role="status">{text.unconfirmed}</p>}
  {loaded&&backend.contextApplied!==undefined&&backend.contextRequested!==backend.contextApplied&&<p role="alert">{text.mismatch}</p>}
  <p className="theme-muted">{mode==='auto'?text.fallback:text.memory}</p>
  {message&&<p role="status">{message}</p>}
 </section>;
}
