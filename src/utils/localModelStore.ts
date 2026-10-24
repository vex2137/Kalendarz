import { openDB } from 'idb';
import { sha256 } from '@noble/hashes/sha2.js';
import { LOCAL_MODEL, bundledModelUrl } from './localModelManifest';
import { DEFAULT_MODEL, type ModelDescriptor } from './modelRegistry';

const database = () => openDB('calendar-local-model', 1, {
  upgrade(db) { db.createObjectStore('models'); },
});

export async function savedModel(descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<Blob | undefined> {
  const db = await database();
  try {
    const model = await db.get('models', descriptor.id);
    if (model?.opfsName) {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
      const file = await (await dir.getFileHandle(model.opfsName)).getFile();
      return file.size === descriptor.bytes ? file : undefined;
    }
    return model instanceof Blob && model.size === descriptor.bytes ? model : undefined;
  } finally { db.close(); }
}

export async function verifyModel(blob: Blob, signal?: AbortSignal, progress?: (loaded: number) => void, descriptor: ModelDescriptor = DEFAULT_MODEL) {
  if (blob.size !== descriptor.bytes) throw new Error('model-size');
  const hash = sha256.create();
  // Bound temporary allocations and yield between chunks, including on older WebViews.
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    signal?.throwIfAborted();
    hash.update(new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer()));
    progress?.(Math.min(blob.size, offset + chunkSize));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const checksum = Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join('');
  if (checksum !== descriptor.sha256) throw new Error('model-checksum');
}

const streamed = new WeakMap<Blob, string>();
export async function discardDownloadedModel(blob?: Blob) {
  const name = blob && streamed.get(blob);
  if (name) { const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'); await dir.removeEntry(name).catch(() => {}); streamed.delete(blob!); }
}
export async function saveModel(blob: Blob, signal: AbortSignal, descriptor: ModelDescriptor = DEFAULT_MODEL) {
  signal.throwIfAborted();
  const db = await database();
  try {
    const tx = db.transaction('models', 'readwrite');
    const abort = () => { try { tx.abort(); } catch { /* Already committed. */ } };
    signal.addEventListener('abort', abort, { once: true });
    try {
      await tx.store.put(streamed.has(blob) ? { opfsName: streamed.get(blob), bytes: descriptor.bytes, sha256: descriptor.sha256 } : blob, descriptor.id);
      await tx.done;
      streamed.delete(blob);
    } finally { signal.removeEventListener('abort', abort); }
  } finally { db.close(); }
  // A denied persistence request does not prevent installation; the UI explains storage removal.
  try { await navigator.storage?.persist?.(); } catch { /* Not available on file origins. */ }
}

export async function removeSavedModel(descriptor: ModelDescriptor = DEFAULT_MODEL) {
  const db = await database();
  try {
    const previous = await db.get('models', descriptor.id);
    await db.delete('models', descriptor.id);
    if (previous?.opfsName) { const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'); await dir.removeEntry(previous.opfsName).catch(() => {}); }
  } finally { db.close(); }
}

export async function downloadModel(signal: AbortSignal, progress: (loaded: number) => void, descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<Blob> {
  if (navigator.storage?.getDirectory) {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
    const name = `${descriptor.id}-${crypto.randomUUID()}.gguf`;
    const handle = await dir.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    try {
      const response = await fetch(descriptor.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok || !response.body) throw new Error('model-download');
      const reader = response.body.getReader();
      let loaded = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const { value, done } = await reader.read(); if (done) break;
          loaded += value.byteLength; if (loaded > descriptor.bytes) throw new Error('model-size');
          await writer.write(value); progress(loaded);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (loaded !== descriptor.bytes) throw new Error('model-size');
      await writer.close();
      const file = await handle.getFile(); streamed.set(file, name); return file;
    } catch (error) { await writer.abort().catch(() => {}); await dir.removeEntry(name).catch(() => {}); throw error; }
  }
  // Older file/WebView origins can import a file without buffering a large download in JS.
  if (descriptor.bytes > 512_000_000) throw new Error('model-stream-storage-unavailable');
  const response = await fetch(descriptor.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok || !response.body) throw new Error('model-download');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      signal.throwIfAborted();
      loaded += value.byteLength;
      if (loaded > descriptor.bytes) throw new Error('model-size');
      chunks.push(value as Uint8Array<ArrayBuffer>);
      progress(loaded);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  chunks.length = 0;
  return blob;
}


// The build stages the exact verified weights beside this small metadata file.
// Availability is cheap; inference independently verifies the actual GGUF bytes.
export async function bundledModelAvailable(descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<boolean> {
  if (!descriptor.bundled) return false;
  try {
    const response = await fetch(bundledModelUrl('manifest.json'), { credentials: 'omit' });
    if (!response.ok) return false;
    const model = await response.json();
    return model.file === LOCAL_MODEL.file && model.bytes === LOCAL_MODEL.bytes && model.sha256 === LOCAL_MODEL.sha256;
  } catch { return false; }
}

export async function loadBundledModel(signal: AbortSignal): Promise<Blob> {
  const response = await fetch(bundledModelUrl(LOCAL_MODEL.file), { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('model-missing');
  const blob = await response.blob();
  if (blob.size !== LOCAL_MODEL.bytes) throw new Error('model-size');
  return blob;
}
