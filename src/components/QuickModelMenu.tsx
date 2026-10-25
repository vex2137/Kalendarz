import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Cpu } from 'lucide-react';
import { AI_MODELS, externalModelChoices } from '../utils/modelRegistry';
import { bundledModelAvailable, hasDownloadedModelData } from '../utils/localModelStore';
import { modelStatus, subscribeModel, selectLocalModel, prepareLocalModel } from '../utils/localModelRuntime';
import { aiInterfaceText } from '../utils/aiInterfaceText';
import { modelErrorText } from '../utils/aiSettingsText';
import type { AppLanguage } from '../utils/i18n';
export function QuickModelMenu({language,onClose}:{language:AppLanguage;onClose:()=>void}) {
  const status=useSyncExternalStore(subscribeModel,modelStatus);
  const choices=[...AI_MODELS,...externalModelChoices()];
  const [ids,setIds]=useState<string[]>([]),[error,setError]=useState<string>();
  const busy=['running','loading','downloading','verifying','checking'].includes(status.phase);
  useEffect(()=>{let current=true;void Promise.all(choices.map(async m=>(m.bundled&&await bundledModelAvailable(m))||await hasDownloadedModelData(m).catch(()=>false)?m.id:'')).then(ids=>{if(current)setIds(ids.filter(Boolean));});return()=>{current=false;};},[]);
  return <div id="ai-quick-model-menu" className="theme-surface theme-border border rounded-xl shadow-xl p-2 space-y-1 w-full" aria-label={aiInterfaceText(language).switch}>
    {choices.filter(m=>ids.includes(m.id)).map(m=><button key={m.id} type="button" disabled={busy} className="theme-hover theme-text rounded-lg p-2 min-h-11 w-full flex items-center gap-2 text-xs disabled:opacity-50" onClick={()=>{void (async()=>{try{await selectLocalModel(m.id);await prepareLocalModel();if(modelStatus().phase==='error')setError(modelStatus().error);else onClose();}catch(error){setError((error as Error).message);}})();}}><Cpu className="w-5 h-5"/><span className="flex-1 text-left">{m.name}</span>{status.modelId===m.id&&<Check className="w-4 h-4"/>}</button>)}
    {error&&<p role="alert" className="text-xs p-2">{modelErrorText(error,language)}</p>}
  </div>;
}
