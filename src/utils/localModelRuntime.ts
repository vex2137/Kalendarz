import type { Wllama } from '@wllama/wllama/esm/index.js';
import { LOCAL_MODEL } from './localModelManifest';
import { bundledModelAvailable, loadBundledModel, downloadModel, removeSavedModel, savedModel, saveModel, verifyModel } from './localModelStore';
import { recordModelMetric, type ModelMetric } from './modelDiagnostics';

export type ModelPhase = 'checking' | 'missing' | 'downloading' | 'verifying' | 'installed' | 'loading' | 'ready' | 'running' | 'error';
export interface ModelStatus { phase: ModelPhase; progress: number; installed: boolean; bundled?: boolean; error?: string }
let status: ModelStatus = { phase: 'checking', progress: 0, installed: false };
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
export const cancelModelOperation = () => { operation?.abort(); loadController?.abort(); };
const idleDelay = () => assistantActive && !document.hidden ? 5 * 60_000 : 30_000;
function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { void unloadLocalModel(); }, idleDelay());
}
export function touchLocalModel() { if ((engine || loading) && !operation) scheduleRelease(); }

// Shared initialization lets a request join a preload rather than fail with model-busy.
export async function prepareLocalModel() {
  if (operation || document.hidden) return;
  const started = performance.now();
  const metric: ModelMetric = { route: 'preload', totalMs: 0 };
  try { await checkLocalModel(); if (status.installed && !engine) { await ensureEngine(metric); metric.totalMs = performance.now() - started; recordModelMetric(metric); } }
  catch { /* A foreground request can retry; the setup UI shows the error. */ }
  finally { if (!operation) scheduleRelease(); }
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
    const bundled = await bundledModelAvailable();
    const installed = bundled || Boolean(await savedModel());
    if (status.phase === 'checking') update({ phase: installed ? 'installed' : 'missing', installed, bundled });
  } catch { update({ phase: 'error', error: 'model-storage' }); }
}

export async function installLocalModel(file?: Blob) {
  if (operation) return;
  const controller = operation = new AbortController();
  const previouslyInstalled = status.installed;
  update({ phase: file ? 'verifying' : 'downloading', progress: 0, error: undefined });
  try {
    const blob = file || await downloadModel(controller.signal, n => update({ progress: n / LOCAL_MODEL.bytes * 100 }));
    update({ phase: 'verifying', progress: 0 });
    await verifyModel(blob, controller.signal, n => update({ progress: n / LOCAL_MODEL.bytes * 100 }));
    await saveModel(blob, controller.signal);
    update({ phase: 'installed', installed: true, progress: 100 });
  } catch (error) {
    update({ phase: controller.signal.aborted ? (previouslyInstalled ? 'installed' : 'missing') : 'error', installed: previouslyInstalled, error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : 'model-download' });
  } finally { operation = undefined; }
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
  await removeSavedModel();
  update({ phase: 'missing', installed: false, progress: 0, error: undefined });
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
      let started = performance.now();
      const blob = await savedModel() || (await bundledModelAvailable() ? await loadBundledModel(controller.signal) : undefined);
      metric.storageMs = performance.now() - started;
      if (!blob) { update({ installed: false }); throw new Error('model-missing'); }
      started = performance.now();
      await verifyModel(blob, controller.signal);
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
          await instance.loadModel([blob], { n_ctx: 2048, n_batch: 128, n_ubatch: 64, n_parallel: 1, n_gpu_layers: 0, n_threads: threads, cache_type_k: 'f16', cache_type_v: 'f16', warmup: true });
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

export async function inferCalendarJson(system: string, prompt: string, schema: unknown, history: { role: 'user' | 'assistant'; content: string }[] = [], options: { maxTokens?: number; threads?: 1 } = {}): Promise<string> {
  if (operation) throw new Error('model-busy');
  const controller = operation = new AbortController();
  releaseRequested = false;
  clearTimeout(idleTimer);
  clearTimeout(preloadTimer);
  const started = performance.now();
  const metric: ModelMetric = { route: 'model', totalMs: 0 };
  const abortLoad = () => loadController?.abort();
  controller.signal.addEventListener('abort', abortLoad);
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const current = await ensureEngine(metric, options.threads);
    controller.signal.throwIfAborted();
    metric.loadMs = performance.now() - started;
    update({ phase: 'running' });
    const result = await current.createChatCompletion({
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? (/opis|description|описан|beschreib/iu.test(prompt) ? 384 : 256), temperature: 0, top_k: 50, penalty_repeat: 1.05,
      response_format: { type: 'json_schema', json_schema: { name: 'calendar_command', schema, strict: true } },
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
