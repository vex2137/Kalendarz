import { openDB } from 'idb';
import { sha256 } from '@noble/hashes/sha2.js';
import { LOCAL_MODEL, bundledModelUrl } from './localModelManifest';
import { DEFAULT_MODEL, type ModelDescriptor } from './modelRegistry';
import { modelFileWriter } from './modelFileWriter';

const database = () => openDB('calendar-local-model', 1, {
  upgrade(db) { db.createObjectStore('models'); },
});
async function ensureSpace(bytes: number) {
  const estimate=await navigator.storage?.estimate?.();
  if(estimate?.quota!==undefined&&estimate.usage!==undefined&&estimate.quota-estimate.usage<bytes+64*1024*1024)throw new Error('model-storage-space');
}
export async function cleanPartialModels(descriptor: ModelDescriptor) {
  if (!navigator.storage?.getDirectory) return;
  const db = await database();
  try {
    const installed = await db.get('models', descriptor.id);
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
    for await (const [name] of dir.entries()) {
      if (name.startsWith(descriptor.id + '-') && name !== installed?.opfsName) await dir.removeEntry(name);
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
  } finally { db.close(); }
}
export async function hasDownloadedModelData(descriptor: ModelDescriptor) {
  return Boolean(await savedModel(descriptor));
}

export async function savedModel(descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<Blob | undefined> {
  const db = await database();
  try {
    const model = await db.get('models', descriptor.id);
    if (model?.opfsName) {
      try {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
        const file = await (await dir.getFileHandle(model.opfsName)).getFile();
        return file.size === descriptor.bytes ? file : undefined;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return undefined;
        throw error;
      }
    }
    return model instanceof Blob && model.size === descriptor.bytes ? model : undefined;
  } finally { db.close(); }
}

// IndexedDB and OPFS can become inconsistent after a killed WebView. Adopt an
// orphan only after full verification, instead of deleting valid weights on retry.
export async function recoverSavedModel(descriptor: ModelDescriptor, signal?: AbortSignal): Promise<Blob | undefined> {
  const existing = await savedModel(descriptor);
  if (existing || !navigator.storage?.getDirectory) return existing;
  let dir: FileSystemDirectoryHandle;
  try { dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'); }
  catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') return; throw error; }
  for await (const [name, handle] of dir.entries()) {
    signal?.throwIfAborted();
    if (!name.startsWith(descriptor.id + '-') || handle.kind !== 'file') continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    if (file.size !== descriptor.bytes) continue;
    try { await verifyModel(file, signal, undefined, descriptor); }
    catch (error) { if (signal?.aborted) throw error; if (error instanceof Error && error.message === 'model-checksum') continue; throw error; }
    signal?.throwIfAborted();
    const db = await database();
    try { await db.put('models', { opfsName:name, bytes:descriptor.bytes, sha256:descriptor.sha256 }, descriptor.id); }
    finally { db.close(); }
    return file;
  }
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
  // Large imports use the same disk-backed representation as streamed downloads.
  if (!streamed.has(blob) && navigator.storage?.getDirectory) {
    await ensureSpace(blob.size);
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
    const name = `${descriptor.id}-${crypto.randomUUID()}.gguf`;
    let writer;
    try {
      writer = await modelFileWriter(await dir.getFileHandle(name, { create: true }), name);
      for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
        signal.throwIfAborted();
        await writer.write(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
      }
      await writer.close(); streamed.set(blob, name);
    } catch (error) { await writer?.abort().catch(() => {}); await dir.removeEntry(name).catch(() => {}); throw error; }
  }
  const db = await database();
  try {
    const previous = await db.get('models', descriptor.id);
    const tx = db.transaction('models', 'readwrite');
    const abort = () => { try { tx.abort(); } catch { /* Already committed. */ } };
    signal.addEventListener('abort', abort, { once: true });
    try {
      await tx.store.put(streamed.has(blob) ? { opfsName: streamed.get(blob), bytes: descriptor.bytes, sha256: descriptor.sha256 } : blob, descriptor.id);
      await tx.done;
      streamed.delete(blob);
      if (previous?.opfsName) {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
        await dir.removeEntry(previous.opfsName).catch(() => {});
      }
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
    if(navigator.storage?.getDirectory)try {
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
      for await(const [name] of dir.entries())if(name===previous?.opfsName||name.startsWith(descriptor.id+'-'))await dir.removeEntry(name);
    }catch(error){if(!(error instanceof DOMException&&error.name==='NotFoundError'))throw error;}
  } finally { db.close(); }
}

export async function downloadModel(signal: AbortSignal, progress: (loaded: number) => void, descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<Blob> {
  await ensureSpace(descriptor.bytes);
  if (navigator.storage?.getDirectory) {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
    const name = `${descriptor.id}-${crypto.randomUUID()}.gguf`;
    const handle = await dir.getFileHandle(name, { create: true });
    let writer;
    try {
      writer = await modelFileWriter(handle, name);
      const response = await fetch(descriptor.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`model-http-${response.status}`);
      if (!response.body) throw new Error('model-download');
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
    } catch (error) { await writer?.abort().catch(() => {}); await dir.removeEntry(name).catch(() => {}); throw error; }
  }
  // Older file/WebView origins can import a file without buffering a large download in JS.
  if (descriptor.bytes > 512_000_000) throw new Error('model-stream-storage-unavailable');
  const response = await fetch(descriptor.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`model-http-${response.status}`);
  if (!response.body) throw new Error('model-download');
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
