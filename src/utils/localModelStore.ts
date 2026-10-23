import { openDB } from 'idb';
import { sha256 } from '@noble/hashes/sha2.js';
import { LOCAL_MODEL, bundledModelUrl } from './localModelManifest';

const database = () => openDB('calendar-local-model', 1, {
  upgrade(db) { db.createObjectStore('models'); },
});

export async function savedModel(): Promise<Blob | undefined> {
  const db = await database();
  try {
    const model: unknown = await db.get('models', LOCAL_MODEL.id);
    return model instanceof Blob && model.size === LOCAL_MODEL.bytes ? model : undefined;
  } finally { db.close(); }
}

export async function verifyModel(blob: Blob, signal?: AbortSignal, progress?: (loaded: number) => void) {
  if (blob.size !== LOCAL_MODEL.bytes) throw new Error('model-size');
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
  if (checksum !== LOCAL_MODEL.sha256) throw new Error('model-checksum');
}

export async function saveModel(blob: Blob, signal: AbortSignal) {
  signal.throwIfAborted();
  const db = await database();
  try {
    const tx = db.transaction('models', 'readwrite');
    const abort = () => { try { tx.abort(); } catch { /* Already committed. */ } };
    signal.addEventListener('abort', abort, { once: true });
    try {
      await tx.store.put(blob, LOCAL_MODEL.id);
      await tx.done;
    } finally { signal.removeEventListener('abort', abort); }
  } finally { db.close(); }
  // A denied persistence request does not prevent installation; the UI explains storage removal.
  try { await navigator.storage?.persist?.(); } catch { /* Not available on file origins. */ }
}

export async function removeSavedModel() {
  const db = await database();
  try { await db.delete('models', LOCAL_MODEL.id); } finally { db.close(); }
}

export async function downloadModel(signal: AbortSignal, progress: (loaded: number) => void): Promise<Blob> {
  const response = await fetch(LOCAL_MODEL.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
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
      if (loaded > LOCAL_MODEL.bytes) throw new Error('model-size');
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
export async function bundledModelAvailable(): Promise<boolean> {
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
