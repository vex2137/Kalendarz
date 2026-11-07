import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ModelDescriptor } from './modelRegistry';
import { transferName } from './resumableModelTransfer';

export interface NativeTransferStatus {
  active?: boolean;
  modelId: string; phase: 'missing'|'downloading'|'verifying'|'installed'|'paused'|'error';
  receivedBytes: number; totalBytes: number; bytesPerSecond?: number; etaSeconds?: number;
  resumeBytes: number; installed?: boolean; verified?: boolean; error?: string;
}
const plugin = registerPlugin<{
  start(options: {model: ModelDescriptor; language: string}): Promise<NativeTransferStatus>;
  status(options: {model: ModelDescriptor}): Promise<NativeTransferStatus>;
  pause(options: {modelId: string}): Promise<NativeTransferStatus>;
  seedBegin(options: {model: ModelDescriptor; etag: string; bytes: number}): Promise<{exists?: boolean; token?: string}>;
  seedWrite(options: {token: string; data: string}): Promise<unknown>;
  seedFinish(options: {token: string}): Promise<unknown>;
  seedAbort(options: {token: string}): Promise<unknown>;
}>('CalendarModelTransfer');

export const hasNativeTransfers = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('CalendarModelTransfer');
export const nativeTransferStatus = (model: ModelDescriptor) => plugin.status({model});
export const pauseNativeTransfer = (modelId: string) => plugin.pause({modelId});
export const nativeTransferRunning = (state: NativeTransferStatus) => state.phase === 'downloading' || state.phase === 'verifying';

// Keep pre-update OPFS checkpoints until native installation succeeds. A torn
// journal or weak validator cannot authorize Range; the original file is retained.
async function seedLegacyTransfer(model: ModelDescriptor, signal: AbortSignal) {
  if (!navigator.storage?.getDirectory) return;
  let file: File, etag: string;
  try {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
    const key = transferName(model);
    const journal = JSON.parse(await (await (await dir.getFileHandle(key + '.json')).getFile()).text());
    if (journal.key !== key || typeof journal.etag !== 'string' || !/^"[^\r\n]*"$/.test(journal.etag)) return;
    etag = journal.etag;
    file = await (await dir.getFileHandle(key + '.gguf')).getFile();
    if (!file.size || file.size > model.bytes) return;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError' || error instanceof SyntaxError) return;
    throw error;
  }
  signal.throwIfAborted();
  const seed = await plugin.seedBegin({model, etag, bytes: file.size});
  if (seed.exists) return;
  if (!seed.token) throw Error('model-upload');
  try {
    for (let offset = 0; offset < file.size; offset += 256 * 1024) {
      signal.throwIfAborted();
      const chunk = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer());
      let binary = '';
      for (let i = 0; i < chunk.length; i += 8192) binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
      await plugin.seedWrite({token: seed.token, data: btoa(binary)});
    }
    signal.throwIfAborted();
    await plugin.seedFinish({token: seed.token});
  } finally { await plugin.seedAbort({token: seed.token}).catch(() => {}); }
}

export async function runNativeTransfer(model: ModelDescriptor, signal: AbortSignal,
  progress: (state: NativeTransferStatus) => void, join = false) {
  let state: NativeTransferStatus;
  if (join) state = await nativeTransferStatus(model);
  else {
    await seedLegacyTransfer(model, signal);
    signal.throwIfAborted();
    let language = 'en';
    try { language = JSON.parse(localStorage.getItem('offline_calendar_settings_v2') || '{}').language || localStorage.getItem('calendar_language') || 'en'; } catch {}
    state = await plugin.start({model, language});
  }
  // Polling reconnects a recreated WebView to durable service state. Native I/O
  // and notification updates keep running while this timer is suspended.
  while (true) {
    progress(state);
    if (state.phase === 'installed' && state.installed !== false) return;
    if (signal.aborted) {
      let paused = await pauseNativeTransfer(model.id);
      const deadline = Date.now() + 10000;
      while (paused.active === true) {
        if (Date.now() >= deadline) throw Error('model-download-pause-timeout');
        await new Promise(resolve => setTimeout(resolve, 100));
        paused = await nativeTransferStatus(model);
      }
      throw Error('model-cancelled');
    }
    if (state.phase === 'paused') throw Error('model-cancelled');
    if (state.phase === 'error') throw Error(state.error || 'model-download');
    if (state.phase === 'missing') throw Error('model-download');
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 500);
      signal.addEventListener('abort', done, {once: true});
    });
    if (!signal.aborted) state = await nativeTransferStatus(model);
  }
}
