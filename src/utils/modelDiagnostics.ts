import { backendMode, backendGpuLayers, backendStatus } from './nativeDesktopAI';
import { BUILD_INFO } from './buildInfo';
import type { AppLanguage } from './i18n';

export interface ModelMetric {
  backend?:string;gpuActive?:boolean;deviceName?:string;ramBytes?:number;vramBytes?:number;fallbackReason?:string;
  contextLength?:number; modelBytes?:number; historyMessages?:number; maxOutputTokens?:number; jsHeapBytes?:number;
  outputTruncated?: boolean;
  modelId?: string;
  quantization?: string;
  engineStateAtStart?: 'loaded' | 'loading' | 'unloaded';
  initializationError?: string;
  errorCode?: string;
  failureReason?: 'output-limit' | 'engine';
  route: 'model' | 'rules' | 'quick' | 'preload'; totalMs: number; loadMs?: number; error?: 'cancelled' | 'inference';
  storageMs?: number; verifyMs?: number; initMs?: number; firstTokenMs?: number; firstAnswerTokenMs?: number;
  promptMs?: number; generationMs?: number; tokensPerSecond?: number;
  promptTokens?: number; cachedTokens?: number; completionTokens?: number;
  threads?: number; multithread?: boolean; isolated?: boolean;
}
let metrics: ModelMetric[] = [];
let runtimeState: Record<string, unknown> | undefined;
export function recordModelState(state:Record<string,unknown>) { runtimeState=state; listeners.forEach(fn=>fn()); }
export interface AssistantTurnMetric {
  id: number; route?: 'quick' | 'rules' | 'model'; uiLanguage: AppLanguage; language: AppLanguage;
  quickChecked: boolean; quickMatched: boolean; rulesMatched: boolean;
  normalized: boolean; inputLength: number; nonAsciiCount: number;
  startedAt: number; quickMs?: number; rulesMs?: number; totalMs: number; uiCommitMs?: number;
  modelPhaseAtSend?: string; commandAction?: string; error?: boolean;
  modelId?: string; quantization?: string; modelLoadedAtSend?: boolean;
}
let turns: AssistantTurnMetric[] = [];
let nativeBuild: { commit: string; applicationId: string; version: string } | undefined;
let session: { openedAt: number; readyForMessagesMs?: number; maxFrameGapMs: number; longTasks: number; longTaskMs: number } | undefined;
export function observeAssistantSession() {
  const current = session = { openedAt: performance.now(), maxFrameGapMs: 0, longTasks: 0, longTaskMs: 0 };
  let previous = performance.now(), frame: number;
  const tick = (at: number) => { if (!document.hidden) current.maxFrameGapMs = Math.max(current.maxFrameGapMs, at - previous); previous = at; frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick);
  const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask') ? new PerformanceObserver(list => {
    for (const entry of list.getEntries()) { current.longTasks++; current.longTaskMs += entry.duration; }
  }) : undefined;
  observer?.observe({ type: 'longtask' });
  return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
}
export function markAssistantInputReady() { if (session) session.readyForMessagesMs ??= performance.now() - session.openedAt; }
const listeners = new Set<() => void>();
export const modelMetrics = () => metrics;
export const assistantTurns = () => turns;
export const nativeBuildInfo = () => nativeBuild;
export function recordAssistantTurn(turn: AssistantTurnMetric) { turns = [...turns.slice(-29), turn]; listeners.forEach(fn => fn()); }
export function recordAssistantUiCommit(id: number) {
  turns = turns.map(turn => turn.id === id ? { ...turn, uiCommitMs: performance.now() - turn.startedAt } : turn);
  listeners.forEach(fn => fn());
}
export function recordNativeBuild(build: typeof nativeBuild) { nativeBuild = build; listeners.forEach(fn => fn()); }
export const subscribeMetrics = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function recordModelMetric(metric: ModelMetric) {
  metrics = [...metrics.slice(-29), metric];
  listeners.forEach(fn => fn());
}
export function runtimeCapabilities() {
  const wasm = WebAssembly as typeof WebAssembly & { Suspending?: unknown };
  return { isolated: globalThis.crossOriginIsolated === true, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', jspi: typeof wasm.Suspending === 'function', hardwareConcurrency: navigator.hardwareConcurrency || 1, deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, userAgent: navigator.userAgent };
}
export type DiagnosticAction = 'backend-mode'|'export-json'|'release-memory'|'device-test'|'import-gguf'|'download-model'|'bridge-info';
export type DiagnosticStage = 'click'|'start'|'bridge-call'|'success'|'cancelled'|'error'|'lookup'|'stream-open'|'copy'|'verify'|'metadata'|'register'|'commit'|'native-cache'|'engine-load';
export interface DiagnosticActionEvent { action:DiagnosticAction; stage:DiagnosticStage; at:number; code?:string; cause?:string; modelId?:string; bytes?:number; expectedBytes?:number; failedStage?:DiagnosticStage }
let actions:DiagnosticActionEvent[]=[];
const firstFailedStage=new WeakMap<object,DiagnosticStage>();
export const diagnosticActions=()=>actions;
export function diagnosticErrorCode(error:unknown) {
  if(typeof DOMException!=='undefined'&&error instanceof DOMException)return error.name==='AbortError'?'model-cancelled':error.name==='QuotaExceededError'?'model-storage-space':`model-storage-${error.name}`;
  const message=error instanceof Error?error.message:typeof error==='string'?error:'';
  return message.match(/(?:model|native|diagnostics)-[a-zA-Z0-9-]+/)?.[0] || 'diagnostics-operation-failed';
}
export function recordDiagnosticAction(action:DiagnosticAction,stage:DiagnosticStage,error?:unknown,context:Partial<Pick<DiagnosticActionEvent,'modelId'|'bytes'|'expectedBytes'|'failedStage'>>={}) {
  if(stage==='error'&&error&&typeof error==='object'&&context.failedStage){if(!firstFailedStage.has(error))firstFailedStage.set(error,context.failedStage);context={...context,failedStage:firstFailedStage.get(error)};}
  const event:DiagnosticActionEvent={action,stage,at:Date.now(),...context,...(error===undefined?{}:{code:diagnosticErrorCode(error),cause:error instanceof Error?error.name:'Unknown'})};
  actions=[...actions.slice(-99),event];
  console.info('AI diagnostic action:',JSON.stringify(event));
  listeners.forEach(fn=>fn());
}
export function diagnosticsReport() {
  return { version: 4, actions, build: BUILD_INFO, nativeBuild, buildMismatch: nativeBuild ? nativeBuild.commit !== BUILD_INFO.commit : undefined, capabilities: runtimeCapabilities(), backend:{...backendStatus(),requestedMode:backendMode(),requestedGpuLayers:backendGpuLayers()}, runtime:runtimeState, session, turns, metrics };
}
