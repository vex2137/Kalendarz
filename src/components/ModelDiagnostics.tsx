import {gpuDiagnosticsSnapshot,subscribeGpuDiagnostics} from '../utils/androidGpuDiagnostics';
import { diagnosticActionText } from '../utils/diagnosticActionText';
import { exportDiagnosticsJson } from '../utils/diagnosticExport';
import { AndroidGpuDiagnostics } from './AndroidGpuDiagnostics';
import { BackendSettings } from './BackendSettings';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AppLanguage } from '../utils/i18n';
import { diagnosticActions, diagnosticErrorCode, recordDiagnosticAction, type DiagnosticAction, diagnosticsReport, modelMetrics, assistantTurns, nativeBuildInfo, recordNativeBuild, subscribeMetrics } from '../utils/modelDiagnostics';
import { inferCalendarJson, modelStatus, subscribeModel, unloadLocalModel, releaseLocalModelMemory } from '../utils/localModelRuntime';
import { findModel } from '../utils/modelRegistry';
import { modelLifecycleText } from '../utils/modelLifecycleText';
import { calendarSystemPrompt, COMMAND_SCHEMA } from '../utils/modelCommand';
import { CalendarDevice } from '../utils/nativeDevice';
import { Capacitor } from '@capacitor/core';
import { BUILD_INFO } from '../utils/buildInfo';
import { desktopAI } from '../utils/nativeDesktopAI';
import { ModelBenchmarks } from './ModelBenchmarks';

const copy = {
  en: ['AI diagnostics', 'Device test: cold + warm', 'Export JSON', 'Release memory', 'Runs the real model twice without saving events. Use airplane mode to verify offline operation.', 'Test failed. Export diagnostics and retry.'],
  pl: ['Diagnostyka AI', 'Test telefonu: zimny + ciepły', 'Eksportuj JSON', 'Zwolnij pamięć', 'Uruchamia prawdziwy model dwa razy bez zapisu wydarzeń. Włącz tryb samolotowy, aby sprawdzić działanie offline.', 'Test nie powiódł się. Wyeksportuj diagnostykę i spróbuj ponownie.'],
  ru: ['Диагностика ИИ', 'Тест: холодный + прогретый', 'Экспорт JSON', 'Освободить память', 'Два запуска настоящей модели без сохранения событий. Включите авиарежим для проверки офлайн.', 'Тест не пройден. Экспортируйте диагностику и повторите.'],
  de: ['KI-Diagnose', 'Gerätetest: kalt + warm', 'JSON exportieren', 'Speicher freigeben', 'Zwei echte Modellaufrufe ohne Termine zu speichern. Offline im Flugmodus prüfen.', 'Test fehlgeschlagen. Diagnose exportieren und erneut versuchen.'],
};
export function ModelDiagnostics({ language, enabled }: { language: AppLanguage; enabled: boolean }) {
  useSyncExternalStore(subscribeGpuDiagnostics,gpuDiagnosticsSnapshot);
  const metrics = useSyncExternalStore(subscribeMetrics, modelMetrics);
  const turns = useSyncExternalStore(subscribeMetrics, assistantTurns);
  useSyncExternalStore(subscribeMetrics, nativeBuildInfo);
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [copyState,setCopyState]=useState<'success'|'error'>();
  const [testing, setTesting] = useState(false);
  useSyncExternalStore(subscribeMetrics, diagnosticActions);
  const [actionState,setActionState]=useState<{pending:boolean;message:string;error?:boolean}>();
  const [bridgeError,setBridgeError]=useState<string>();
  const actionRunning=useRef(false);
  const [singleThread, setSingleThread] = useState(false);
  const text = copy[language],feedback=diagnosticActionText(language);
  useEffect(() => {
    let current=true;
    if (Capacitor.getPlatform() === 'android') {
      recordDiagnosticAction('bridge-info','bridge-call');
      void CalendarDevice.diagnosticsBuildInfo().then(build=>{recordNativeBuild(build);recordDiagnosticAction('bridge-info','success');}).catch(error=>{recordDiagnosticAction('bridge-info','error',error);if(current)setBridgeError(diagnosticErrorCode(error));});
    }
    return ()=>{current=false;};
  }, []);
  const busy = testing || ['loading', 'running', 'downloading', 'verifying', 'checking'].includes(status.phase);
  const runAction=async(action:DiagnosticAction,work:()=>Promise<string>,pending:string)=>{
    recordDiagnosticAction(action,'click');
    if(actionRunning.current)return;
    actionRunning.current=true;setActionState({pending:true,message:pending});recordDiagnosticAction(action,'start');
    try {
      const message=await work();
      const cancelled=message===feedback.cancelled;
      recordDiagnosticAction(action,cancelled?'cancelled':'success');
      setActionState({pending:false,message});
    }catch(error){
      recordDiagnosticAction(action,'error',error);
      setActionState({pending:false,error:true,message:`${action==='export-json'?feedback.exportError:action==='release-memory'?feedback.releaseError:text[5]} (${diagnosticErrorCode(error)})`});
    }finally{actionRunning.current=false;}
  };
  const test = () => runAction('device-test',async()=>{
    setTesting(true);
    try {
      await unloadLocalModel();
      const system = calendarSystemPrompt(language, new Date());
      const query = language === 'pl' ? 'Dodaj wydarzenie Pomiar jutro o 14:15' : 'Add event Measurement tomorrow at 14:15';
      await inferCalendarJson(system, `Current request:\n${query}`, COMMAND_SCHEMA, [], { threads: singleThread ? 1 : undefined });
      await inferCalendarJson(system, `Current request:\n${query}`, COMMAND_SCHEMA, [], { threads: singleThread ? 1 : undefined });
      return feedback.tested;
    }finally{setTesting(false);}
  },feedback.testing);
  const exportJson = () => runAction('export-json',async()=>{
    const result=await exportDiagnosticsJson(diagnosticsReport());
    return result==='saved'?feedback.saved:result==='cancelled'?feedback.cancelled:feedback.download;
  },feedback.exporting);
  const release = () => runAction('release-memory',async()=>{
    const result=await releaseLocalModelMemory();
    return result==='released'?feedback.released:feedback.already;
  },feedback.releasing);
  const last = [...metrics].reverse().find(metric=>metric.route==='model');
  const labels = {
    en:['Current model attempt','Model access (last load)','Integrity check (last load)','Initialization (last load)','Prompt processing','TTFT (current request)','Generation','Tokens/s','Input / output tokens','Context / CPU threads','Native RAM / JS heap'],
    pl:['Bieżąca próba modelu','Dostęp do modelu (ostatnie ładowanie)','Kontrola integralności (ostatnie ładowanie)','Inicjalizacja (ostatnie ładowanie)','Przetwarzanie promptu','TTFT (bieżące żądanie)','Generowanie','Tokeny/s','Tokeny wejścia / wyjścia','Kontekst / wątki CPU','RAM natywny / sterta JS'],
    de:['Aktueller Modellversuch','Modellzugriff (letztes Laden)','Integritätsprüfung (letztes Laden)','Initialisierung (letztes Laden)','Promptverarbeitung','TTFT (aktuelle Anfrage)','Generierung','Token/s','Eingabe- / Ausgabetokens','Kontext / CPU-Threads','Nativer RAM / JS-Heap'],
    ru:['Текущий вызов модели','Доступ (последняя загрузка)','Проверка (последняя загрузка)','Инициализация (последняя загрузка)','Обработка запроса','TTFT (текущий запрос)','Генерация','Токенов/с','Входные / выходные токены','Контекст / потоки CPU','Нативная RAM / куча JS'],
  }[language];
  const missing=({en:'No data',pl:'brak danych',de:'Keine Daten',ru:'Нет данных'})[language];
  const valid=(n?:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const ms=(n?:number)=>!valid(n)?missing:`${n!.toFixed(0)} ms`;
  const mib=(n?:number)=>!valid(n)?missing:`${(n!/1048576).toFixed(1)} MiB`;
  const number=(n?:number)=>valid(n)?String(n):missing;
  const values=last?[ms(last.totalMs),ms(last.storageMs),ms(last.verifyMs),ms(last.initMs),ms(last.promptMs),ms(last.firstTokenMs),ms(last.generationMs),valid(last.tokensPerSecond)?last.tokensPerSecond!.toFixed(1):missing,`${number(last.promptTokens)} / ${number(last.completionTokens)}`,`${number(last.contextLength)} / ${number(last.threads)}`,`${mib(last.ramBytes)} / ${mib(last.jsHeapBytes)}`]:[];
  return <section data-testid="model-diagnostics" className="p-3 text-xs theme-text">
    <h4 className="font-semibold">{text[0]}</h4>
    <p className="my-2">{findModel(status.modelId).name} · {findModel(status.modelId).quantization} · {findModel(status.modelId).bytes.toLocaleString()} B<br/>{modelLifecycleText(language).disk}: {status.installed?modelLifecycleText(language).yes:modelLifecycleText(language).no} · {modelLifecycleText(language).ram}: {status.loaded?modelLifecycleText(language).yes:modelLifecycleText(language).no}</p>
    {status.error && <p role="alert" className="break-words">{status.error}{status.errorDetail ? ': '+status.errorDetail : ''}</p>}
    <p className="mt-2 break-all" data-build-commit={BUILD_INFO.commit}>Commit: {BUILD_INFO.commit}{BUILD_INFO.dirty ? ' (modified)' : ''}</p>
    <p data-assistant-route={turns.at(-1)?.route || 'none'}>{({ en: 'Last message path', pl: 'Ścieżka ostatniej wiadomości', ru: 'Путь последнего сообщения', de: 'Pfad der letzten Nachricht' })[language]}: {turns.at(-1)?.route || '—'} {turns.at(-1) ? `(${turns.at(-1)!.language}, ${Math.round(turns.at(-1)!.totalMs)} ms)` : ''}</p>
    <AndroidGpuDiagnostics language={language}/>
    <BackendSettings language={language} busy={testing||Boolean(actionState?.pending)||['running','verifying','downloading'].includes(status.phase)}/>
    {last && <dl className="grid grid-cols-2 gap-x-3 gap-y-1 my-3" data-testid="inference-metrics">{labels.map((label,i)=><div key={label} className="contents"><dt className="theme-muted">{label}</dt><dd>{values[i]}</dd></div>)}</dl>}
    {last && <p data-testid="metric-backend">{({en:'Backend of last model attempt',pl:'Backend ostatniej próby modelu',de:'Backend des letzten Modellversuchs',ru:'Бэкенд последнего вызова модели'})[language]}: {last.backend||missing}{last.backend==='vulkan'&&last.gpuActive!==true?' (GPU ?)':''}</p>}
    {last?.error && <p data-testid="metric-attempt-error">{({en:'Incomplete model attempt',pl:'Nieukończona próba modelu',de:'Unvollständiger Modellversuch',ru:'Незавершённый вызов модели'})[language]}: {last.errorCode||last.error}</p>}
    {last && <p className="theme-muted" data-testid="metric-timing-scope">{({en:'Last-load timings may include background initialization before this request; they are not components of its total.',pl:'Czasy ostatniego ładowania mogą obejmować inicjalizację w tle sprzed tego żądania; nie są składnikami jego sumy.',de:'Die Zeiten des letzten Ladens können Hintergrundinitialisierung vor dieser Anfrage enthalten; sie sind keine Bestandteile ihrer Gesamtdauer.',ru:'Последняя загрузка могла начаться в фоне до этого запроса; её время не является частью общего времени запроса.'})[language]}</p>}
    <p className="my-2">{text[4]}</p>
    {!desktopAI() && <label className="flex gap-2 mb-2"><input type="checkbox" checked={singleThread} disabled={busy} onChange={e => setSingleThread(e.target.checked)} />{({ en: 'Compare with one CPU thread', pl: 'Porównaj z jednym wątkiem CPU', ru: 'Сравнить с одним потоком CPU', de: 'Mit einem CPU-Thread vergleichen' })[language]}</label>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || actionState?.pending || !enabled || !status.installed} onClick={() => { void test(); }} className="theme-border border rounded p-2 disabled:opacity-50">{text[1]}</button>
      <button id="btn-ai-export-diagnostics" type="button" disabled={actionState?.pending} onClick={()=>{void exportJson();}} className="theme-border border rounded p-2">{text[2]}</button>
      <button id="btn-ai-release-memory" type="button" disabled={busy||actionState?.pending} onClick={()=>{void release();}} className="theme-border border rounded p-2 disabled:opacity-50">{text[3]}</button>
    </div>
    {actionState && <p data-testid="diagnostic-action-result" role={actionState.error?'alert':'status'} aria-live="polite" aria-busy={actionState.pending} className="mt-2 break-words">{actionState.pending && <span className="inline-block animate-spin mr-2" aria-hidden="true">◌</span>}{actionState.message}</p>}
    {busy&&!actionState?.pending&&<p role="status">{feedback.busy}</p>}
    {bridgeError&&<p role="alert">{feedback.bridgeError} ({bridgeError})</p>}
    <div className="relative mt-2" data-testid="full-diagnostic-json">
      <button type="button" aria-label={({en:'Copy full diagnostics',pl:'Kopiuj pełną diagnostykę',de:'Vollständige Diagnose kopieren',ru:'Копировать полную диагностику'})[language]} className="absolute right-1 top-1 theme-surface theme-border border rounded p-2" onClick={()=>{const json=JSON.stringify(diagnosticsReport(),null,2);void Promise.resolve().then(()=>navigator.clipboard.writeText(json)).then(()=>setCopyState('success')).catch(()=>setCopyState('error'));}}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button>
      <pre id="ai-diagnostics-report" className="overflow-auto max-h-48 pr-12">{JSON.stringify(diagnosticsReport(),null,2)}</pre>
      {copyState&&<p role={copyState==='error'?'alert':'status'}>{(copyState==='success'?{en:'Diagnostics copied.',pl:'Skopiowano diagnostykę.',de:'Diagnose kopiert.',ru:'Диагностика скопирована.'}:{en:'Could not copy diagnostics. Try exporting JSON.',pl:'Nie udało się skopiować diagnostyki. Spróbuj eksportu JSON.',de:'Kopieren fehlgeschlagen. JSON exportieren.',ru:'Не удалось скопировать. Экспортируйте JSON.'})[language]}</p>}
    </div>
    <ModelBenchmarks language={language} disabled={busy || actionState?.pending || !enabled || !status.installed}/>
  </section>;
}
