import type { Wllama } from '@wllama/wllama/esm/index.js';
import { LOCAL_MODEL } from './localModelManifest';
import { bundledModelAvailable, loadBundledModel, downloadModel, removeSavedModel, savedModel, recoverSavedModel, saveModel, verifyModel, discardDownloadedModel, cleanPartialModels } from './localModelStore';
import { recordModelMetric, recordModelState, type ModelMetric } from './modelDiagnostics';
import { activeModel, DEFAULT_MODEL, OPTIONAL_FALLBACK, findModel, persistModelSelection } from './modelRegistry';

export type ModelPhase = 'checking' | 'missing' | 'downloading' | 'verifying' | 'installed' | 'loading' | 'ready' | 'running' | 'error';
export interface ModelStatus { phase: ModelPhase; progress: number; installed: boolean; loaded: boolean; bundled?: boolean; importing?: boolean; error?: string; errorDetail?: string; modelId: string }
const operationMarker = 'calendar_model_operation_v1';
const initialModelId = activeModel().id;
let recoveryRequired = false;
try { recoveryRequired = localStorage.getItem(operationMarker) === initialModelId; } catch {}
const markModelOperation = (id: string) => { try { localStorage.setItem(operationMarker,id); } catch {} };
const clearModelOperation = (id: string) => { try { if(localStorage.getItem(operationMarker)===id)localStorage.removeItem(operationMarker); } catch {} };
let status: ModelStatus = { phase: 'checking', progress: 0, installed: false, loaded: false, modelId: initialModelId, ...(recoveryRequired ? {error:'model-previous-operation'} : {}) };
const listeners = new Set<() => void>();
export const modelStatus = () => status;
export const subscribeModel = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const update = (patch: Partial<ModelStatus>) => { status = { ...status, ...patch }; recordModelState({...status,quantization:findModel(status.modelId).quantization}); listeners.forEach(l => l()); };
let engine: Wllama | undefined;
let operation: AbortController | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let preloadTimer: ReturnType<typeof setTimeout> | undefined;
let loading: Promise<Wllama> | undefined;
let loadController: AbortController | undefined;
let disposing: Promise<void> = Promise.resolve();
let releaseRequested = false;
let assistantActive = false;
let lifecycleInstalled = false;
let actualThreads = 1;
let transition = false;
let lastLoad: Pick<ModelMetric, 'storageMs' | 'verifyMs' | 'initMs'> = {};
const runtimeError = (error: unknown) => error instanceof Error && error.message.startsWith('model-') ? error.message : error instanceof Error && /out of memory|bad_alloc|memory access out of bounds|cannot enlarge memory|allocation failed/iu.test(error.message) ? 'model-memory' : error instanceof DOMException ? `model-storage-${error.name}` : 'model-inference';
export async function selectLocalModel(id: string) {
  const descriptor = findModel(id);
  if (descriptor.id !== id) throw new Error('model-unknown');
  if (operation || transition) throw new Error('model-busy');
  if (status.modelId === id) return;
  transition = true;
  try {
    await unloadLocalModel();
    clearModelOperation(status.modelId); recoveryRequired = false;
    persistModelSelection(descriptor);
    update({ modelId: id, phase: 'checking', progress: 0, installed: false, loaded: false, bundled: false, error: undefined, errorDetail:undefined });
    await checkLocalModel();
  } finally { transition = false; }
}
export const restoreFallbackModel = () => selectLocalModel(OPTIONAL_FALLBACK.id);
export async function retryLocalModel() {
  if(operation||transition)return;
  recoveryRequired=false;clearModelOperation(status.modelId);
  update({phase:'checking',error:undefined,errorDetail:undefined});
  await checkLocalModel();
  await prepareLocalModel();
}
export const cancelModelOperation = () => { operation?.abort(); loadController?.abort(); };
const idleDelay = () => assistantActive && !document.hidden ? 5 * 60_000 : 30_000;
function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { void unloadLocalModel(); }, idleDelay());
}
export function touchLocalModel() { if ((engine || loading) && !operation) scheduleRelease(); }

// Shared initialization lets a request join a preload rather than fail with model-busy.
export async function prepareLocalModel() {
  if (operation || transition || recoveryRequired || document.hidden) return;
  const started = performance.now();
  const metric: ModelMetric = { route:'preload',modelId:status.modelId,quantization:findModel(status.modelId).quantization,engineStateAtStart:engine?'loaded':loading?'loading':'unloaded',totalMs:0 };
  try { await checkLocalModel(); if (status.installed && status.phase !== 'error' && !engine) await ensureEngine(metric); }
  catch (error) { metric.error = (error instanceof Error && error.name==='AbortError') || status.phase==='installed' ? 'cancelled' : 'inference'; }
  finally { metric.totalMs = performance.now() - started; recordModelMetric(metric); if (!operation) scheduleRelease(); }
}
export function setAssistantActive(active: boolean) {
  assistantActive = active;
  clearTimeout(preloadTimer);
  if (!lifecycleInstalled) {
    lifecycleInstalled = true;
    const resume = () => {
      if (document.hidden) { cancelModelOperation(); scheduleRelease(); }
      else if (assistantActive) { clearTimeout(preloadTimer); preloadTimer = setTimeout(() => { void prepareLocalModel(); }, 300); }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('calendar-app-resume', resume);
    window.addEventListener('calendar-memory-pressure', () => { void unloadLocalModel(); });
    window.addEventListener('pagehide', () => { void unloadLocalModel(); });
  }
  if (active && !document.hidden) preloadTimer = setTimeout(() => { void prepareLocalModel(); }, 300);
  else { cancelModelOperation(); scheduleRelease(); }
}

export async function checkLocalModel() {
  if (engine || loading || !['checking','installed','missing','error'].includes(status.phase)) return;
  const descriptor = findModel(status.modelId);
  const phaseAtStart = status.phase;
  try {
    const bundled = await bundledModelAvailable(descriptor);
    const installed = bundled || Boolean(await recoverSavedModel(descriptor));
    if (!engine && !loading && status.phase === phaseAtStart && status.modelId === descriptor.id) update({ phase: recoveryRequired || phaseAtStart === 'error' && installed ? 'error' : installed ? 'installed' : 'missing', installed, loaded:false, bundled });
  } catch (error) { if(status.modelId===descriptor.id && !loading && !engine) update({ phase:'error', error:runtimeError(error), loaded:false,...(error instanceof Error && ['model-size','model-checksum'].includes(error.message)?{installed:false}:{}) }); }
}

export async function installLocalModel(file?: Blob | { url: string; bytes: number }) {
  if (operation || transition) return;
  transition = true;
  try { await unloadLocalModel(); } catch (error) { transition = false; throw error; }
  const descriptor = findModel(status.modelId);
  const controller = operation = new AbortController();
  const previouslyInstalled = status.installed;
  let blob: Blob | undefined;
  update({ phase: file instanceof Blob ? 'verifying' : 'downloading', importing: Boolean(file), progress: 0, error: undefined });
  try {
    const existing = await recoverSavedModel(descriptor, controller.signal).catch(error => { if (error instanceof Error && ['model-size','model-checksum'].includes(error.message)) return undefined; throw error; });
    // A second install request adopts verified bytes instead of downloading/copying again.
    if (!file && (existing || descriptor.bundled && await bundledModelAvailable(descriptor))) {
      if (existing) await verifyModel(existing, controller.signal, undefined, descriptor);
      update({phase:'installed',installed:true,loaded:false,progress:100,error:undefined});
      return;
    }
    await cleanPartialModels(descriptor);
    if(file && !(file instanceof Blob) && file.bytes !== descriptor.bytes) throw new Error('model-size');
    blob = file instanceof Blob ? file : await downloadModel(controller.signal, n => update({ progress: n / descriptor.bytes * 100 }), file ? {...descriptor,url:file.url} : descriptor);
    update({ phase: 'verifying', progress: 0 });
    await verifyModel(blob, controller.signal, n => update({ progress: n / descriptor.bytes * 100 }), descriptor);
    await saveModel(blob, controller.signal, descriptor, n => update({progress:n / descriptor.bytes * 100}));
    update({ phase: 'installed', installed: true, loaded:false, progress: 100, error:undefined,errorDetail:undefined });
  } catch (error) {
    update({ phase: controller.signal.aborted ? (previouslyInstalled ? 'installed' : 'missing') : 'error', installed: previouslyInstalled, error: controller.signal.aborted ? undefined : error instanceof DOMException && error.name === 'QuotaExceededError' ? 'model-storage-space' : error instanceof Error ? error.message : 'model-download' });
  } finally { try { await discardDownloadedModel(blob); } finally { operation = undefined; transition = false; update({importing:false}); } }
}

export async function unloadLocalModel() {
  clearTimeout(preloadTimer);
  clearTimeout(idleTimer);
  if (operation) { releaseRequested = true; cancelModelOperation(); return; }
  loadController?.abort();
  if (loading) await loading.catch(() => {});
  await disposeEngine();
}

async function disposeEngine() {
  const current = engine;
  engine = undefined;
  if (current) disposing = disposing.then(() => current.exit()).catch(() => {});
  await disposing;
  update({loaded:false, ...(status.installed && status.phase !== 'error' ? { phase:'installed' as const } : {})});
}

export async function deleteLocalModel() {
  if (operation) return;
  await unloadLocalModel();
  const descriptor = findModel(status.modelId);
  await removeSavedModel(descriptor);
  const bundled = await bundledModelAvailable(descriptor);
  update({ phase: bundled ? 'installed' : 'missing', installed: bundled, bundled, progress: 0, error: undefined });
}

function assetUrl(path: string) {
  const url = new URL(path, document.baseURI);
  // Electron exposes only the two packaged WASM assets through a restricted protocol.
  return url.protocol === 'file:' ? `calendar-asset://runtime/${url.pathname.split('/').pop()}` : url.href;
}

async function ensureEngine(metric: Partial<ModelMetric> = {}, threadOverride?: 1): Promise<Wllama> {
  await disposing;
  if (loading) return loading;
  if (engine) return engine;
  const controller = loadController = new AbortController();
  loading = (async () => {
    let instance: Wllama | undefined;
    let loadNotes = '';
    try {
      update({ phase: 'loading', loaded:false, error: undefined, errorDetail:undefined });
      const descriptor = findModel(status.modelId);
      markModelOperation(descriptor.id);
      metric.modelId = descriptor.id;
      let started = performance.now();
      const bundled = await bundledModelAvailable(descriptor);
      const blob = bundled ? await loadBundledModel(controller.signal) : await recoverSavedModel(descriptor, controller.signal);
      metric.storageMs = performance.now() - started;
      if (!blob) { update({ installed: false }); throw new Error('model-missing'); }
      // Disk presence and engine residency are separate. This also wins a race
      // with an initial storage check that was overtaken by foreground inference.
      update({installed:true});
      started = performance.now();
      await verifyModel(blob, controller.signal, undefined, descriptor);
      metric.verifyMs = performance.now() - started;
      started = performance.now();
      const [{ Wllama }, wasm, compatWasm, compatWorker] = await Promise.all([
        import('@wllama/wllama/esm/index.js'),
        import('@wllama/wllama/esm/wasm/wllama.wasm?url'),
        import('@wllama/wllama-compat/wasm/wllama.wasm?url'),
        import('@wllama/wllama-compat/wasm/wllama.js?raw'),
      ]);
      const cores = navigator.hardwareConcurrency || 1;
      const smallDevice = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
      actualThreads = globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined' && !smallDevice ? (cores >= 4 ? 4 : cores >= 2 ? 2 : 1) : 1;
      if (threadOverride) actualThreads = threadOverride;
      for (const threads of actualThreads > 1 ? [actualThreads, 1] : [1]) {
        controller.signal.throwIfAborted();
        let initializing = true;
        instance = new Wllama({ default: assetUrl(wasm.default) }, { suppressNativeLog: false, logger: { log() {}, debug() {}, warn() {}, error(...args: unknown[]) { if (initializing) loadNotes = (loadNotes + args.map(String).join(' ')).slice(-600); } } });
        instance.setCompat({ wasm: assetUrl(compatWasm.default), worker: { code: compatWorker.default } }, 'firefox_safari');
        try {
          await instance.loadModel([blob], { n_ctx: descriptor.maxContext, n_batch: 128, n_ubatch: 64, n_parallel: 1, n_gpu_layers: 0, n_threads: threads, cache_type_k: 'f16', cache_type_v: 'f16', warmup: true });
          initializing = false;
          actualThreads = instance.isMultithread() ? threads : 1;
          break;
        } catch (error) { await instance.exit().catch(() => {}); instance = undefined; if (threads === 1 || controller.signal.aborted) throw error; }
      }
      controller.signal.throwIfAborted();
      metric.initMs = performance.now() - started;
      engine = instance!;
      lastLoad = {storageMs:metric.storageMs,verifyMs:metric.verifyMs,initMs:metric.initMs};
      update({ phase: 'ready', installed:true, loaded:true });
      if(!operation)clearModelOperation(descriptor.id);
      return engine;
    } catch (error) {
      metric.initializationError = loadNotes || (error instanceof Error ? error.message.slice(0,600) : 'model-load');
      if(error instanceof Error&&['model-size','model-checksum'].includes(error.message))update({installed:false});
      clearModelOperation(status.modelId);
      await instance?.exit().catch(() => {});
      update({ phase: controller.signal.aborted ? (status.installed?'installed':'checking') : 'error', loaded:false, error:controller.signal.aborted ? undefined : runtimeError(error), errorDetail:controller.signal.aborted ? undefined : metric.initializationError });
      throw error;
    }
  })();
  try { return await loading; } finally { loading = undefined; loadController = undefined; }
}

export interface InferenceOptions { maxTokens?: number; threads?: 1; timeoutMs?: number }
export const inferCalendarJson = (system: string, prompt: string, schema: unknown, history: { role: 'user' | 'assistant'; content: string }[] = [], options: InferenceOptions = {}) => inferLocalCompletion(system, prompt, schema, history, options);
export const inferLocalText = (system: string, prompt: string, history: { role: 'user' | 'assistant'; content: string }[] = [], options: InferenceOptions = {}) => inferLocalCompletion(system, prompt, undefined, history, options);
async function inferLocalCompletion(system: string, prompt: string, schema: unknown, history: { role: 'user' | 'assistant'; content: string }[] = [], options: InferenceOptions = {}): Promise<string> {
  if (operation || transition) throw new Error('model-busy');
  // A foreground request is an explicit retry; interrupted models never auto-preload.
  if (recoveryRequired) { recoveryRequired=false; clearModelOperation(status.modelId); }
  const controller = operation = new AbortController();
  const descriptor = findModel(status.modelId);
  markModelOperation(descriptor.id);
  releaseRequested = false;
  clearTimeout(idleTimer);
  clearTimeout(preloadTimer);
  const started = performance.now();
  const engineStateAtStart = engine ? 'loaded' : loading ? 'loading' : 'unloaded';
  const metric: ModelMetric = { route: 'model', modelId: status.modelId, quantization:descriptor.quantization, engineStateAtStart, totalMs: 0 };
  const abortLoad = () => loadController?.abort();
  controller.signal.addEventListener('abort', abortLoad);
  const timeout = setTimeout(() => controller.abort('model-timeout'), options.timeoutMs ?? (status.modelId === DEFAULT_MODEL.id ? 120_000 : 600_000));
  try {
    const current = await ensureEngine(metric, options.threads);
    if (engineStateAtStart !== 'loaded') Object.assign(metric,lastLoad);
    controller.signal.throwIfAborted();
    metric.loadMs = performance.now() - started;
    update({ phase: 'running' });
    const result = await current.createChatCompletion({
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? (descriptor.id === 'lfm2.5-2.6b-q4-k-m' ? 768 : /opis|description|описан|beschreib/iu.test(prompt) ? 384 : 256), temperature: 0, top_k: 50, penalty_repeat: 1.05,
      ...(schema ? { response_format: { type: 'json_schema' as const, json_schema: { name: 'calendar_command', schema, strict: true } } } : {}),
      ...(descriptor.architecture === 'qwen35' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      abortSignal: controller.signal,
      stream: true,
    });
    let text = '', finish: string | null = null;
    for await (const chunk of result) {
      const choice = chunk.choices[0];
      const content = choice?.delta?.content;
      const delta = choice?.delta as { reasoning_content?: string; reasoning?: string } | undefined;
      if (content || delta?.reasoning_content || delta?.reasoning) metric.firstTokenMs ??= performance.now() - started;
      if (content) { metric.firstAnswerTokenMs ??= performance.now() - started; text += content; }
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (chunk.usage) Object.assign(metric, { promptTokens: chunk.usage.prompt_tokens, cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens, completionTokens: chunk.usage.completion_tokens });
      if (chunk.timings) Object.assign(metric, { promptMs: chunk.timings.prompt_ms, generationMs: chunk.timings.predicted_ms, tokensPerSecond: chunk.timings.predicted_per_second, promptTokens: chunk.timings.prompt_n + chunk.timings.cache_n, cachedTokens: chunk.timings.cache_n, completionTokens: chunk.timings.predicted_n });
    }
    controller.signal.throwIfAborted();
    // A length-limited conversation remains useful text. A partial calendar
    // command must never reach parsing/confirmation as a successful completion.
    if (finish !== 'stop' && !(schema === undefined && finish === 'length' && text)) throw new Error('model-incomplete');
    if (finish === 'length') metric.outputTruncated = true;
    if (!text) throw new Error('model-response');
    Object.assign(metric, { threads: actualThreads, multithread: current.isMultithread(), isolated: globalThis.crossOriginIsolated, totalMs: performance.now() - started });
    recordModelMetric(metric);
    console.info('Local model performance:', JSON.stringify(metric));
    update({ phase: 'ready' });
    return text;
  } catch (error) {
    console.warn('Local model operation failed', { modelId: status.modelId, cancelled: controller.signal.aborted, outputLimit: error instanceof Error && error.message === 'model-incomplete' });
    const code = controller.signal.aborted ? controller.signal.reason === 'model-timeout' ? 'model-timeout' : 'model-cancelled' : runtimeError(error);
    recordModelMetric({ ...metric,errorCode:code, failureReason: error instanceof Error && error.message === 'model-incomplete' ? 'output-limit' : 'engine', totalMs: performance.now() - started, error: code === 'model-cancelled' ? 'cancelled' : 'inference' });
    await disposeEngine();
    update({ phase: code === 'model-cancelled' ? (status.installed?'installed':'missing') : 'error', loaded:false, error:code === 'model-cancelled' ? undefined : code });
    throw new Error(code);
  } finally { clearModelOperation(descriptor.id); clearTimeout(timeout); controller.signal.removeEventListener('abort', abortLoad); operation = undefined; if (releaseRequested) await disposeEngine(); else scheduleRelease(); }
}
