import type { Wllama } from '@wllama/wllama/esm/index.js';
import { LOCAL_MODEL } from './localModelManifest';
import { bundledModelAvailable, loadBundledModel, downloadModel, removeSavedModel, savedModel, saveModel, verifyModel, discardDownloadedModel } from './localModelStore';
import { recordModelMetric, type ModelMetric } from './modelDiagnostics';
import { activeModel, DEFAULT_MODEL, findModel, persistModelSelection } from './modelRegistry';

export type ModelPhase = 'checking' | 'missing' | 'downloading' | 'verifying' | 'installed' | 'loading' | 'ready' | 'running' | 'error';
export interface ModelStatus { phase: ModelPhase; progress: number; installed: boolean; bundled?: boolean; error?: string; modelId: string }
let status: ModelStatus = { phase: 'checking', progress: 0, installed: false, modelId: activeModel().id };
const listeners = new Set<() => void>();
export const modelStatus = () => status;
export const subscribeModel = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const update = (patch: Partial<ModelStatus>) => { status = { ...status, ...patch }; listeners.forEach(l => l()); };
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
export async function selectLocalModel(id: string) {
  const descriptor = findModel(id);
  if (descriptor.id !== id) throw new Error('model-unknown');
  if (operation || transition) throw new Error('model-busy');
  if (status.modelId === id) return;
  transition = true;
  try {
    await unloadLocalModel();
    persistModelSelection(descriptor);
    update({ modelId: id, phase: 'checking', progress: 0, installed: false, bundled: false, error: undefined });
    await checkLocalModel();
  } finally { transition = false; }
}
export const restoreFallbackModel = () => selectLocalModel(DEFAULT_MODEL.id);
export const cancelModelOperation = () => { operation?.abort(); loadController?.abort(); };
const idleDelay = () => assistantActive && !document.hidden ? 5 * 60_000 : 30_000;
function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { void unloadLocalModel(); }, idleDelay());
}
export function touchLocalModel() { if ((engine || loading) && !operation) scheduleRelease(); }

// Shared initialization lets a request join a preload rather than fail with model-busy.
export async function prepareLocalModel() {
  if (operation || transition || document.hidden) return;
  const started = performance.now();
  const metric: ModelMetric = { route: 'preload', totalMs: 0 };
  try { await checkLocalModel(); if (status.installed && !engine) await ensureEngine(metric); }
  catch { metric.error = loadController?.signal.aborted ? 'cancelled' : 'inference'; }
  finally { metric.totalMs = performance.now() - started; recordModelMetric(metric); if (!operation) scheduleRelease(); }
}
export function setAssistantActive(active: boolean) {
  assistantActive = active;
  clearTimeout(preloadTimer);
  if (!lifecycleInstalled) {
    lifecycleInstalled = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelModelOperation(); scheduleRelease(); });
    window.addEventListener('calendar-memory-pressure', () => { void unloadLocalModel(); });
    window.addEventListener('pagehide', () => { void unloadLocalModel(); });
  }
  if (active && !document.hidden) preloadTimer = setTimeout(() => { void prepareLocalModel(); }, 300);
  else { cancelModelOperation(); scheduleRelease(); }
}

export async function checkLocalModel() {
  if (status.phase !== 'checking') return;
  try {
    const descriptor = findModel(status.modelId);
    const bundled = await bundledModelAvailable(descriptor);
    const installed = bundled || Boolean(await savedModel(descriptor));
    if (status.phase === 'checking') update({ phase: installed ? 'installed' : 'missing', installed, bundled });
  } catch { update({ phase: 'error', error: 'model-storage' }); }
}

export async function installLocalModel(file?: Blob) {
  if (operation || transition) return;
  transition = true;
  try { await unloadLocalModel(); } catch (error) { transition = false; throw error; }
  const descriptor = findModel(status.modelId);
  const controller = operation = new AbortController();
  const previouslyInstalled = status.installed;
  let blob: Blob | undefined;
  update({ phase: file ? 'verifying' : 'downloading', progress: 0, error: undefined });
  try {
    blob = file || await downloadModel(controller.signal, n => update({ progress: n / descriptor.bytes * 100 }), descriptor);
    update({ phase: 'verifying', progress: 0 });
    await verifyModel(blob, controller.signal, n => update({ progress: n / descriptor.bytes * 100 }), descriptor);
    await saveModel(blob, controller.signal, descriptor);
    update({ phase: 'installed', installed: true, progress: 100 });
  } catch (error) {
    update({ phase: controller.signal.aborted ? (previouslyInstalled ? 'installed' : 'missing') : 'error', installed: previouslyInstalled, error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : 'model-download' });
  } finally { try { await discardDownloadedModel(blob); } finally { operation = undefined; transition = false; } }
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
  if (status.installed) update({ phase: 'installed' });
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
    try {
      update({ phase: 'loading', error: undefined });
      const descriptor = findModel(status.modelId);
      metric.modelId = descriptor.id;
      let started = performance.now();
      const blob = await savedModel(descriptor) || (await bundledModelAvailable(descriptor) ? await loadBundledModel(controller.signal) : undefined);
      metric.storageMs = performance.now() - started;
      if (!blob) { update({ installed: false }); throw new Error('model-missing'); }
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
        instance = new Wllama({ default: assetUrl(wasm.default) }, { suppressNativeLog: true, logger: { log() {}, debug() {}, warn() {}, error() {} } });
        instance.setCompat({ wasm: assetUrl(compatWasm.default), worker: { code: compatWorker.default } }, 'firefox_safari');
        try {
          await instance.loadModel([blob], { n_ctx: descriptor.maxContext, n_batch: 128, n_ubatch: 64, n_parallel: 1, n_gpu_layers: 0, n_threads: threads, cache_type_k: 'f16', cache_type_v: 'f16', warmup: true });
          actualThreads = instance.isMultithread() ? threads : 1;
          break;
        } catch (error) { await instance.exit().catch(() => {}); instance = undefined; if (threads === 1 || controller.signal.aborted) throw error; }
      }
      controller.signal.throwIfAborted();
      metric.initMs = performance.now() - started;
      engine = instance!;
      update({ phase: 'ready' });
      return engine;
    } catch (error) {
      await instance?.exit().catch(() => {});
      update({ phase: controller.signal.aborted ? 'installed' : 'error', error: controller.signal.aborted ? undefined : 'model-inference' });
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
  const controller = operation = new AbortController();
  releaseRequested = false;
  clearTimeout(idleTimer);
  clearTimeout(preloadTimer);
  const started = performance.now();
  const metric: ModelMetric = { route: 'model', modelId: status.modelId, totalMs: 0 };
  const abortLoad = () => loadController?.abort();
  controller.signal.addEventListener('abort', abortLoad);
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? (status.modelId === DEFAULT_MODEL.id ? 120_000 : 300_000));
  try {
    const current = await ensureEngine(metric, options.threads);
    controller.signal.throwIfAborted();
    metric.loadMs = performance.now() - started;
    update({ phase: 'running' });
    const result = await current.createChatCompletion({
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? (/opis|description|описан|beschreib/iu.test(prompt) ? 384 : 256), temperature: 0, top_k: 50, penalty_repeat: 1.05,
      ...(schema ? { response_format: { type: 'json_schema' as const, json_schema: { name: 'calendar_command', schema, strict: true } } } : {}),
      chat_template_kwargs: { enable_thinking: false },
      abortSignal: controller.signal,
      stream: true,
    });
    let text = '', finish: string | null = null;
    for await (const chunk of result) {
      const choice = chunk.choices[0];
      const content = choice?.delta?.content;
      if (content) { metric.firstTokenMs ??= performance.now() - started; text += content; }
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (chunk.usage) Object.assign(metric, { promptTokens: chunk.usage.prompt_tokens, cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens, completionTokens: chunk.usage.completion_tokens });
      if (chunk.timings) Object.assign(metric, { promptMs: chunk.timings.prompt_ms, generationMs: chunk.timings.predicted_ms, tokensPerSecond: chunk.timings.predicted_per_second, promptTokens: chunk.timings.prompt_n + chunk.timings.cache_n, cachedTokens: chunk.timings.cache_n, completionTokens: chunk.timings.predicted_n });
    }
    controller.signal.throwIfAborted();
    if (finish !== 'stop') throw new Error('model-incomplete');
    if (!text) throw new Error('model-response');
    Object.assign(metric, { threads: actualThreads, multithread: current.isMultithread(), isolated: globalThis.crossOriginIsolated, totalMs: performance.now() - started });
    recordModelMetric(metric);
    console.info('Local model performance:', JSON.stringify(metric));
    update({ phase: 'ready' });
    return text;
  } catch (error) {
    console.error('Local model inference failed', error);
    recordModelMetric({ ...metric, totalMs: performance.now() - started, error: controller.signal.aborted ? 'cancelled' : 'inference' });
    await disposeEngine();
    update({ phase: controller.signal.aborted ? 'installed' : 'error', error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : 'model-inference' });
    throw new Error(controller.signal.aborted ? 'model-cancelled' : 'model-inference');
  } finally { clearTimeout(timeout); controller.signal.removeEventListener('abort', abortLoad); operation = undefined; if (releaseRequested) await disposeEngine(); else scheduleRelease(); }
}
