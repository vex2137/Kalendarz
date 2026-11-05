import { diagnosticActionText } from '../utils/diagnosticActionText';
import { diagnosticActions, recordDiagnosticAction, diagnosticErrorCode, type DiagnosticAction } from '../utils/modelDiagnostics';
import { BackendSettings } from './BackendSettings';
import { ModelFoldersPanel } from './ModelFoldersPanel';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Cpu, Download, Upload, Activity, CheckCircle2, Check, HardDrive, Laptop, Settings, Star, Trash2, Play, Info } from 'lucide-react';
import { modelChoices, PREFERRED_MODEL, OPTIONAL_FALLBACK, findModel, type ModelDescriptor } from '../utils/modelRegistry';
import { hasDownloadedModelData, bundledModelAvailable, removeSavedModel } from '../utils/localModelStore';
import { importLocalModel, cancelModelOperation, deleteLocalModel, installLocalModel, modelStatus, restoreFallbackModel, retryLocalModel, selectLocalModel, subscribeModel } from '../utils/localModelRuntime';
import { assistantUiText } from '../utils/assistantUiText';
import type { AppLanguage } from '../utils/i18n';
import { Capacitor } from '@capacitor/core';
import { modelsForHuggingFaceLink } from '../utils/modelLinks';
import { aiSettingsText, modelErrorText } from '../utils/aiSettingsText';
import { modelLifecycleText } from '../utils/modelLifecycleText';
import { localModelText } from '../utils/localModelText';
import { aiInterfaceText } from '../utils/aiInterfaceText';
import { setAssistantBackground, useAssistantBackground } from '../utils/assistantBackground';
import { nativeModelUrl, pickNativeModel, releaseNativeModel } from '../utils/nativeModelImport';

export function ModelManager({ language, enabled, onDiagnostics }: { language: AppLanguage; enabled: boolean; onDiagnostics?: () => void }) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [installed, setInstalled] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [operationMessage,setOperationMessage]=useState<string>();
  const [link, setLink] = useState('');
  const [matches, setMatches] = useState<readonly string[]>();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const catalogue = useRef<HTMLDivElement>(null);
  const background = useAssistantBackground();
  const feedback=diagnosticActionText(language);
  const settings = aiSettingsText(language), text = assistantUiText(language), view = aiInterfaceText(language), lifecycle = modelLifecycleText(language);
  const descriptor = findModel(status.modelId);
  const busy = picking || ['checking', 'downloading', 'verifying', 'loading', 'running'].includes(status.phase);
  useEffect(() => {
    let current = true;
    void Promise.all(modelChoices().map(async model => (model.bundled && await bundledModelAvailable(model)) || await hasDownloadedModelData(model).catch(() => false) ? model.id : '')).then(ids => { if (current) setInstalled(ids.filter(Boolean)); });
    return () => { current = false; };
  }, [status.phase, status.modelId]);
  useEffect(()=>{
    const input=fileInput.current;
    const cancel=()=>{recordDiagnosticAction('import-gguf','cancelled');setOperationMessage(feedback.cancelled);};
    input?.addEventListener('cancel',cancel);return ()=>input?.removeEventListener('cancel',cancel);
  },[feedback.cancelled]);
  const perform = (fn: () => Promise<unknown>,action?:DiagnosticAction) => {
    setError(undefined);setOperationMessage(action==='import-gguf'?feedback.importing:action==='download-model'?feedback.downloading:undefined);
    if(action)recordDiagnosticAction(action,'start');
    void fn().then(()=>{if(action){recordDiagnosticAction(action,'success');setOperationMessage(feedback.modelSuccess);}}).catch(error=>{
      const code=diagnosticErrorCode(error);setOperationMessage(undefined);
      if(action)recordDiagnosticAction(action,code==='model-cancelled'?'cancelled':'error',code==='model-cancelled'?undefined:error);
      if(code==='model-cancelled')setOperationMessage(feedback.cancelled);else setError(code);
    });
  };
  const importFile = (file: File) => { setPicking(true); perform(async () => { try { await importLocalModel(file,file.name); } finally { setPicking(false); } },'import-gguf'); };
  const importNative = async () => {
    setPicking(true); setError(undefined);setOperationMessage(feedback.importing);recordDiagnosticAction('import-gguf','start');
    let token: string | undefined;
    try {
      recordDiagnosticAction('import-gguf','bridge-call');
      const file = await pickNativeModel(); if (file.cancelled) {recordDiagnosticAction('import-gguf','cancelled');setOperationMessage(feedback.cancelled);return;}
      token = file.token;
      await importLocalModel({url:nativeModelUrl(file.token),bytes:file.bytes},file.name);
      setOperationMessage(feedback.modelSuccess);recordDiagnosticAction('import-gguf','success');
    } catch (error) {const code=diagnosticErrorCode(error);recordDiagnosticAction('import-gguf',code==='model-cancelled'?'cancelled':'error',error);setOperationMessage(code==='model-cancelled'?feedback.cancelled:undefined);if(code!=='model-cancelled')setError(code);}
    finally { if (token) await releaseNativeModel(token).catch(error=>{recordDiagnosticAction('import-gguf','error',error);setError('model-import-release');}); setPicking(false); }
  };
  const openImport = () => { recordDiagnosticAction('import-gguf','click');setOperationMessage(feedback.importing);if (Capacitor.getPlatform() === 'android') void importNative(); else fileInput.current?.click(); };
  const lastFailure=[...diagnosticActions()].reverse().find(event=>event.stage==='error'&&event.failedStage&&event.code===(error||status.error));
  const failureLabels={en:['Stage','Type'],pl:['Etap','Typ'],de:['Schritt','Typ'],ru:['Этап','Тип']}[language];
  const modelIcon = (model: ModelDescriptor) => model.bundled ? <Activity className="w-6 h-6"/> : <Box className="w-6 h-6"/>;
  return <div className="space-y-3 ai-design" aria-label={text.models}>
    <article className="ai-active-card rounded-2xl border overflow-hidden" data-testid="active-model-card">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="ai-model-icon rounded-xl w-11 h-11 flex items-center justify-center shrink-0">{modelIcon(descriptor)}</span>
          <div className="min-w-0 flex-1"><p className="theme-muted text-xs">{view.active}</p><h4 className="font-semibold text-sm break-words mt-1">{descriptor.name}</h4></div>
          {descriptor.id === PREFERRED_MODEL.id && <span className="ai-model-badge rounded-full px-2 py-1 text-[10px] flex gap-1 items-center"><Star className="w-3 h-3"/>{view.preferred}</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]" data-testid="model-disk-ram">
          <span title={lifecycle.disk} className={`ai-status-badge ${status.installed ? 'ai-status-ok' : ''}`}>{status.installed && <CheckCircle2 className="w-3.5 h-3.5"/>}{status.installed ? view.installed : view.missing}</span>
          <span title={lifecycle.ram} className={`ai-status-badge ${status.loaded ? 'ai-status-ok' : ''}`}>{status.loaded && <CheckCircle2 className="w-3.5 h-3.5"/>}{status.loaded ? view.loaded : view.unloaded}</span>
          <span className="ai-status-badge">Offline</span>
        </div>
        <p className="theme-muted flex items-center gap-2 text-xs"><Laptop className="w-4 h-4"/>{view.local}</p>
        {!['installed','ready','missing'].includes(status.phase) && <p role="status" className="text-xs theme-muted">{status.importing && status.phase === 'downloading' ? view.importing : localModelText(language)[status.phase]}</p>}
      </div>
      <div className="theme-border border-t p-3 flex items-center gap-3 theme-subtle">
        <span className="theme-surface rounded-full p-2"><Settings className="w-5 h-5"/></span>
        <label htmlFor="ai-background-work" className="flex-1 text-sm">{view.background}<span className="block theme-muted text-[11px] mt-1">{Capacitor.getPlatform() === 'android' || !navigator.userAgent.includes('Electron/') ? view.backgroundHint : view.desktopHint}</span></label>
        <button id="ai-background-work" role="switch" aria-checked={background} aria-label={view.background} onClick={() => setAssistantBackground(!background)} className={`ai-switch shrink-0 ${background ? 'ai-switch-on' : ''}`}><span/></button>
      </div>
    </article>
    <BackendSettings language={language} busy={picking||['downloading','verifying','running'].includes(status.phase)}/>
    <ModelFoldersPanel language={language} busy={busy||!enabled}/>
    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
      <button id="ai-download-model" type="button" disabled={busy || !enabled} className="ai-primary min-h-12 rounded-lg px-1 flex gap-1 items-center justify-center disabled:opacity-50" onClick={() => {recordDiagnosticAction('download-model','click');setDownloadOpen(true);catalogue.current?.scrollIntoView({block:'nearest'});}}><Download className="w-5 h-5 shrink-0"/>{view.download}</button>
      <button id="ai-import-gguf" type="button" disabled={busy || !enabled} className="ai-action min-h-12 rounded-lg px-1 flex gap-1 items-center justify-center disabled:opacity-50" onClick={openImport}><Upload className="w-5 h-5 shrink-0"/>{view.import}</button>
      <button type="button" className="ai-action min-h-12 rounded-lg px-1 flex gap-1 items-center justify-center" onClick={onDiagnostics}><Activity className="w-5 h-5 shrink-0"/>{settings.diagnostics}</button>
    </div>
    <input ref={fileInput} type="file" className="sr-only" accept=".gguf,application/octet-stream" aria-label={text.import} disabled={busy || !enabled} onChange={event => {const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)importFile(file);}}/>
    <p className="text-[11px] theme-muted flex gap-2"><Info className="w-4 h-4 shrink-0"/>{view.importHint}</p>
    {['downloading','verifying'].includes(status.phase) && <div role="status"><progress className="w-full" value={status.progress>=0?status.progress:undefined} max={100}/><span>{status.progress>=0?`${Math.floor(status.progress)}%`:view.importing}</span></div>}
    {operationMessage && !error && status.phase!=='error' && <p role="status" aria-live="polite" data-testid="model-operation-result">{operationMessage}</p>}
    {(error || status.phase === 'error') && <p role="alert" className="text-xs">{modelErrorText(error || status.error,language)} {status.installed && lifecycle.retry}{lastFailure && <span className="block mt-1">{failureLabels[0]}: {lastFailure.failedStage} · {failureLabels[1]}: {lastFailure.cause||'Error'} · {lastFailure.code}</span>}</p>}
    {busy && status.phase !== 'checking' && <button type="button" className="ai-action rounded-lg p-2 min-h-11" onClick={cancelModelOperation}>{text.cancel}</button>}
    {status.phase === 'error' && !busy && <button type="button" className="ai-action rounded-lg p-2 min-h-11" onClick={() => perform(retryLocalModel)}>{text.retry}</button>}
    {!installed.includes(PREFERRED_MODEL.id) && !(descriptor.id === PREFERRED_MODEL.id && status.installed) && <p className="theme-muted text-xs">{lifecycle.offer}</p>}
    {downloadOpen && <form className="theme-subtle theme-border border rounded-xl p-3 space-y-2" onSubmit={event => {event.preventDefault();setError(undefined);try{setMatches(modelsForHuggingFaceLink(link).map(model=>model.id));}catch(error){setMatches(undefined);setError((error as Error).message);}}}>
      <label className="block text-xs">{settings.link}<input type="url" aria-label={settings.link} value={link} onChange={event=>setLink(event.target.value)} className="theme-input w-full rounded-lg p-2 mt-1" placeholder="https://huggingface.co/…" required/></label>
      <button type="submit" disabled={busy} className="ai-action rounded-lg p-2 min-h-11">{settings.resolve}</button>
      {matches && <button type="button" onClick={()=>{setMatches(undefined);setLink('');}} className="underline ml-2">{text.models}</button>}
      <p className="theme-muted text-xs">{settings.hint}</p>
    </form>}
    <div ref={catalogue} className="space-y-3"><h4 className="font-semibold text-base">{view.catalogue}</h4>
      {modelChoices().sort((a,b)=>Number(b.id===PREFERRED_MODEL.id)-Number(a.id===PREFERRED_MODEL.id)).filter(model=>!matches||matches.includes(model.id)).map(model=>{
        const active=status.modelId===model.id;
        const onDisk=active ? status.installed : installed.includes(model.id);
        return <article key={model.id} className={`ai-model-card theme-border border rounded-xl p-3 space-y-2 ${active?'ai-model-selected':''}`} data-model-id={model.id}>
          <div className="flex items-start gap-3">
            <span className="ai-model-icon rounded-xl w-10 h-10 flex items-center justify-center shrink-0">{modelIcon(model)}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-sm break-words">{model.name}</p><p className="theme-muted text-[11px] flex flex-wrap gap-x-2 gap-y-1 mt-1"><span className="inline-flex items-center gap-1"><HardDrive className="w-3.5 h-3.5"/>{(model.bytes/1_000_000).toFixed(1)} MB</span><span className="inline-flex items-center gap-1"><Cpu className="w-3.5 h-3.5"/>{text.memory}: ~{model.estimatedRamMB} MB</span></p></div>
            {active && <span className="ai-model-badge rounded-full px-2 py-1 text-[10px]">{text.selected}</span>}
          </div>
          {onDisk && <p role="status" className="text-xs text-emerald-500 flex gap-2 items-center"><CheckCircle2 className="w-4 h-4"/>{settings.installed}</p>}
          <div className="flex gap-2 text-xs">
            {active ? <span className="ai-model-badge rounded-lg p-2 min-h-11 flex-1 flex items-center justify-center gap-2"><Check className="w-4 h-4"/>{view.used}</span> : <button type="button" disabled={busy||!enabled} className="ai-primary rounded-lg p-2 min-h-11 flex-1 flex items-center justify-center gap-2 disabled:opacity-50" onClick={()=>perform(()=>selectLocalModel(model.id))}><Play className="w-4 h-4"/>{text.select}</button>}
            {active && !onDisk && !model.imported && model.url && <button type="button" disabled={busy||!enabled} className="ai-primary rounded-lg p-2 min-h-11 disabled:opacity-50" onClick={()=>{recordDiagnosticAction('download-model','click');perform(()=>installLocalModel(),'download-model');}}>{text.download}</button>}
            {!model.bundled && onDisk && <button type="button" disabled={busy} className="ai-action rounded-lg p-2 min-h-11 flex items-center gap-2 disabled:opacity-50" onClick={()=>perform(async()=>{if(active)await deleteLocalModel();else await removeSavedModel(model);setInstalled(ids=>ids.filter(id=>id!==model.id));})}><Trash2 className="w-4 h-4"/>{text.remove}</button>}
          </div>
          {model.bundled && <p className="theme-muted text-[11px]">{view.bundled}</p>}
          {!model.imported && <details className="theme-muted text-[11px]"><summary className="cursor-pointer">{view.source}{model.experimental ? ` · ${text.experimental}` : ''}</summary><a className="underline" href={model.license} target="_blank" rel="noreferrer">{model.licenseName}</a>{model.url && <a className="underline ml-2" href={model.url.split('/resolve/')[0]} target="_blank" rel="noreferrer">{new URL(model.url).pathname.split('/')[1]}</a>}</details>}
        </article>;
      })}
    </div>
    {descriptor.id !== OPTIONAL_FALLBACK.id && <button type="button" disabled={busy} className="ai-action p-2 rounded-lg min-h-11 disabled:opacity-50" onClick={()=>perform(restoreFallbackModel)}>{text.fallback}</button>}
    <p className="theme-muted text-[11px]">{text.privacy}</p>
  </div>;
}
