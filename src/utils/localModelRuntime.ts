import type { Wllama } from '@wllama/wllama/esm/index.js';
import { LOCAL_MODEL } from './localModelManifest';
import { downloadModel, removeSavedModel, savedModel, saveModel, verifyModel } from './localModelStore';

export type ModelPhase = 'checking' | 'missing' | 'downloading' | 'verifying' | 'installed' | 'loading' | 'ready' | 'running' | 'error';
export interface ModelStatus { phase: ModelPhase; progress: number; installed: boolean; error?: string }
let status: ModelStatus = { phase: 'checking', progress: 0, installed: false };
const listeners = new Set<() => void>();
export const modelStatus = () => status;
export const subscribeModel = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const update = (patch: Partial<ModelStatus>) => { status = { ...status, ...patch }; listeners.forEach(l => l()); };
let engine: Wllama | undefined;
let operation: AbortController | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
export const cancelModelOperation = () => operation?.abort();

export async function checkLocalModel() {
  if (status.phase !== 'checking') return;
  try {
    const installed = Boolean(await savedModel());
    if (status.phase === 'checking') update({ phase: installed ? 'installed' : 'missing', installed });
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
  clearTimeout(idleTimer);
  const current = engine;
  engine = undefined;
  if (current) await current.exit();
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

export async function inferCalendarJson(system: string, prompt: string, schema: unknown): Promise<string> {
  if (operation) throw new Error('model-busy');
  const controller = operation = new AbortController();
  clearTimeout(idleTimer);
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    if (!engine) {
      const blob = await savedModel();
      if (!blob) { update({ installed: false }); throw new Error('model-missing'); }
      update({ phase: 'loading', error: undefined });
      await verifyModel(blob, controller.signal);
      const [{ Wllama }, wasm, compatWasm, compatWorker] = await Promise.all([
        import('@wllama/wllama/esm/index.js'),
        import('@wllama/wllama/esm/wasm/wllama.wasm?url'),
        import('@wllama/wllama-compat/wasm/wllama.wasm?url'),
        import('@wllama/wllama-compat/wasm/wllama.js?raw'),
      ]);
      const instance = new Wllama({ default: assetUrl(wasm.default) }, {
        suppressNativeLog: true,
        logger: { log() {}, debug() {}, warn() {}, error() {} },
      });
      // Never use wllama's default CDN fallback: both builds ship with the application.
      instance.setCompat({ wasm: assetUrl(compatWasm.default), worker: { code: compatWorker.default } }, 'firefox_safari');
      engine = instance;
      await instance.loadModel([blob], {
        n_ctx: 2048, n_batch: 128, n_ubatch: 64, n_parallel: 1,
        n_gpu_layers: 0, // Portable CPU SIMD path, including Android WebView and older GPUs.
        n_threads: globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1,
        cache_type_k: 'f16', cache_type_v: 'f16', warmup: false,
      });
    }
    controller.signal.throwIfAborted();
    update({ phase: 'running' });
    const result = await engine.createChatCompletion({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      max_tokens: 384, temperature: 0.1, top_k: 50, penalty_repeat: 1.05,
      response_format: { type: 'json_schema', json_schema: { name: 'calendar_command', schema, strict: true } },
      abortSignal: controller.signal,
    });
    if (result.choices[0]?.finish_reason !== 'stop') throw new Error('model-incomplete');
    const text = result.choices[0]?.message.content;
    if (!text) throw new Error('model-response');
    update({ phase: 'ready' });
    idleTimer = setTimeout(() => { void unloadLocalModel(); }, 60_000);
    return text;
  } catch (error) {
    try { await unloadLocalModel(); } catch { engine = undefined; }
    update({ phase: 'error', error: controller.signal.aborted ? 'model-cancelled' : error instanceof Error ? error.message : 'model-inference' });
    throw new Error(controller.signal.aborted ? 'model-cancelled' : 'model-inference');
  } finally { clearTimeout(timeout); operation = undefined; }
}
