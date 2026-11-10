import { recordDiagnosticAction, type DiagnosticStage } from './modelDiagnostics';
import { androidAIReady } from './nativeAndroidAI';
import { nativeModelResponse } from './nativeModelImport';
import { openDB } from 'idb';
import { sha256 } from '@noble/hashes/sha2.js';
import { BUILD_INFO, buildBundlesModel } from './buildInfo';
import { LOCAL_MODEL, bundledModelUrl } from './localModelManifest';
import { DEFAULT_MODEL, type ModelDescriptor } from './modelRegistry';
import { desktopAI, ensureNativeModel } from './nativeDesktopAI';
import { modelFileWriter } from './modelFileWriter';
import { resumableModelTransfer, removeModelTransfer, modelTransferBytes } from './resumableModelTransfer';
import { hasNativeTransfers, nativeTransferStatus } from './nativeModelTransfer';
import { ggufMetadata, ggufStreamMetadata } from './ggufMetadata';

type VerificationSource = { id: string; token: string } | { id: string; opfsName: string; modified: number };
const verificationSources = new WeakMap<Blob, VerificationSource>();

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
  if (await hasNativeModelData(descriptor)) return true;
  return Boolean(await savedModel(descriptor));
}

export async function hasNativeModelData(descriptor:ModelDescriptor){ await androidAIReady;if(descriptor.imported&&desktopAI()?.registerImported)await desktopAI()!.registerImported!(descriptor);return Boolean(await desktopAI()?.info(descriptor.id).then(value=>value.installed)); }

export async function installedModelMetadata(descriptor:ModelDescriptor) {
  if(await hasNativeModelData(descriptor)){
    const url=desktopAI()?.platform==='android'?new URL(`/_calendar_native_model/${descriptor.id}`,location.origin).href:`calendar-asset://installed-models/${descriptor.id}`;
    return ggufStreamMetadata(await fetch(url),descriptor.bytes);
  }
  const blob=await savedLegacyModel(descriptor);
  if(blob)return ggufMetadata(blob);
}

export async function savedModel(descriptor:ModelDescriptor=DEFAULT_MODEL):Promise<Blob|undefined>{
  if(desktopAI()?.platform==='android'){
    const legacy=await savedLegacyModel(descriptor);if(legacy)return legacy;
  }
  if(await hasNativeModelData(descriptor)){
    const url=desktopAI()?.platform==='android'?new URL(`/_calendar_native_model/${descriptor.id}`,location.origin).href:`calendar-asset://installed-models/${descriptor.id}`;
    const response=await fetch(url);if(!response.ok)throw Error('model-storage');return response.blob();
  }
  return savedLegacyModel(descriptor);
}
async function savedLegacyModel(descriptor:ModelDescriptor):Promise<Blob|undefined>{
  const db = await database();
  try {
    const model = await db.get('models', descriptor.id);
    if (model?.opfsName) {
      try {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
        const file = await (await dir.getFileHandle(model.opfsName)).getFile();
        if(file.size!==descriptor.bytes)throw new Error('model-size');
        verificationSources.set(file,{id:descriptor.id,opfsName:model.opfsName,modified:file.lastModified});
        return file;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return undefined;
        throw error;
      }
    }
    if (model instanceof Blob || model?.blob instanceof Blob) {
      // Give legacy bytes a durable identity before verifying. A replacement
      // cannot accidentally receive the checksum of an older same-size Blob.
      const tx = db.transaction('models', 'readwrite');
      let current = await tx.store.get(descriptor.id);
      if (current instanceof Blob) {
        if (current.size !== descriptor.bytes) { await tx.done; throw Error('model-size'); }
        current = { blob: current, verificationToken: crypto.randomUUID() };
        await tx.store.put(current, descriptor.id);
      }
      await tx.done;
      if (!(current?.blob instanceof Blob)) return savedLegacyModel(descriptor);
      if (current.blob.size !== descriptor.bytes) throw Error('model-size');
      if (typeof current.verificationToken === 'string') verificationSources.set(current.blob,{id:descriptor.id,token:current.verificationToken});
      return current.blob;
    }
    return undefined;
  } finally { db.close(); }
}

// IndexedDB and OPFS can become inconsistent after a killed WebView. Adopt an
// orphan only after full verification, instead of deleting valid weights on retry.
export async function recoverSavedModel(descriptor: ModelDescriptor, signal?: AbortSignal): Promise<Blob | undefined> {
  let existing: Blob | undefined, damaged: unknown;
  try { existing=await savedModel(descriptor); }
  catch(error){if(error instanceof Error&&error.message==='model-size')damaged=error;else throw error;}
  if (existing || !navigator.storage?.getDirectory) {if(damaged)throw damaged;return existing;}
  let dir: FileSystemDirectoryHandle;
  try { dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'); }
  catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') {if(damaged)throw damaged;return;} throw error; }
  for await (const [name, handle] of dir.entries()) {
    signal?.throwIfAborted();
    // A complete transfer/import can outlive a failed native commit or a changed URL.
    // Adopt only after the exact expected size and full pinned SHA-256 match.
    const candidate=name.startsWith(descriptor.id+'-') || /^transfer-[a-f0-9]{64}\.gguf$/.test(name) || /^import-staging-[a-f0-9-]{36}\.gguf$/.test(name);
    if (!candidate || handle.kind !== 'file') continue;
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
  if(damaged)throw damaged;
}

export async function verifyModel(blob: Blob, signal?: AbortSignal, progress?: (loaded: number) => void, descriptor: ModelDescriptor = DEFAULT_MODEL) {
  if (blob.size !== descriptor.bytes) throw new Error('model-size');
  const checksum = await modelChecksum(blob, signal, progress);
  if (checksum !== descriptor.sha256) throw new Error('model-checksum');
}

export async function modelChecksum(blob: Blob, signal?: AbortSignal, progress?: (loaded: number) => void) {
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
  return checksum;
}

const streamed = new WeakMap<Blob, string>();
const transfers = new WeakMap<Blob, ModelDescriptor>();
async function finishTransfer(blob: Blob) {
  const descriptor = transfers.get(blob);
  if (descriptor) { await removeModelTransfer(descriptor); transfers.delete(blob); }
}
const copiedChecksums=new WeakMap<Blob,string>();
export const copiedModelChecksum=(blob:Blob)=>copiedChecksums.get(blob);
export async function discardDownloadedModel(blob?: Blob, invalid = false) {
  if (blob && invalid) await finishTransfer(blob);
  const name = blob && streamed.get(blob);
  if (name) { const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'); await dir.removeEntry(name).catch(() => {}); streamed.delete(blob!); }
}
export async function saveModel(blob: Blob, signal: AbortSignal, descriptor: ModelDescriptor = DEFAULT_MODEL, progress?: (loaded:number)=>void, action:'import-gguf'|'download-model'='import-gguf') {
  signal.throwIfAborted();
  if(desktopAI()&&desktopAI()?.platform!=='android'){if(descriptor.imported&&desktopAI()?.registerImported)await desktopAI()!.registerImported!(descriptor);await ensureNativeModel(descriptor.id,blob,signal,progress);signal.throwIfAborted();await removeLegacyModel(descriptor);await finishTransfer(blob);return;}
  // Large imports use the same disk-backed representation as streamed downloads.
  if (!streamed.has(blob) && navigator.storage?.getDirectory) {
    recordDiagnosticAction(action,'copy',undefined,{modelId:descriptor.id,bytes:blob.size});
    await ensureSpace(blob.size);
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
    const name = `${descriptor.id}-${crypto.randomUUID()}.gguf`;
    let writer;
    try {
      writer = await modelFileWriter(await dir.getFileHandle(name, { create: true }), name);
      for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
        signal.throwIfAborted();
        await writer.write(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer());
        progress?.(Math.min(blob.size, offset + 4 * 1024 * 1024));
      }
      await writer.close(); streamed.set(blob, name);
      recordDiagnosticAction(action,'verify',undefined,{modelId:descriptor.id,bytes:blob.size});
      await verifyModel(await (await dir.getFileHandle(name)).getFile(), signal, progress, descriptor);
    } catch (error) { await writer?.abort().catch(() => {}); await dir.removeEntry(name).catch(() => {}); throw error; }
  }
  const db = await database();
  try {
    const previous = await db.get('models', descriptor.id);
    recordDiagnosticAction(action,'commit',undefined,{modelId:descriptor.id,bytes:blob.size});
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
  await finishTransfer(blob);
  try { await navigator.storage?.persist?.(); } catch { /* Not available on file origins. */ }
}

export async function removeSavedModel(descriptor: ModelDescriptor = DEFAULT_MODEL) {
  if(desktopAI())await desktopAI()!.remove(descriptor.id);
  await removeLegacyModel(descriptor);
  if (typeof navigator.storage?.getDirectory === 'function') await removeModelTransfer(descriptor);
}
export async function removeLegacyModel(descriptor: ModelDescriptor) {
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

async function openModelDownload(url:string,signal:AbortSignal,bytes=-1) {
  const native=await nativeModelResponse(url,signal,bytes);
  if(native)return native;
  let response:Response;
  try { response=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'}); }
  catch(error) {if(signal.aborted)throw error;throw Error('model-download');}
  if(!response.ok) {
    const local=new URL(url,globalThis.location?.origin || 'https://localhost');
    if(local.origin===globalThis.location?.origin&&local.pathname.startsWith('/_calendar_model_import/')){
      const code=response.headers.get('X-Calendar-Import-Error');
      throw Error(code&&/^model-import-(expired|permission|unavailable|read|incomplete)$/.test(code)?code:'model-import-file');
    }
    throw Error(`model-http-${response.status}`);
  }
  return response;
}

export async function downloadModel(signal: AbortSignal, progress: (loaded: number) => void, descriptor: ModelDescriptor = DEFAULT_MODEL, verifying?: () => void): Promise<Blob> {
  const expected=descriptor.bytes>0?descriptor.bytes:undefined;
  if(expected===undefined&&!new URL(descriptor.url,location.origin).pathname.startsWith('/_calendar_model_import/'))throw Error('model-input');
  const limit=expected??16*1024**3;
  const remote = /^https?:$/.test(new URL(descriptor.url, location.origin).protocol) && !new URL(descriptor.url, location.origin).pathname.startsWith('/_calendar_model_import/');
  if (remote && expected && typeof navigator.storage?.getDirectory === 'function') {
    const file = await resumableModelTransfer(descriptor, signal, progress, async file => { verifying?.(); await verifyModel(file, signal, undefined, descriptor); }, ensureSpace);
    transfers.set(file, descriptor); return file;
  }
  await ensureSpace(expected??64*1024*1024);
  if (navigator.storage?.getDirectory) {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
    const name = `${descriptor.id}-${crypto.randomUUID()}.gguf`;
    const handle = await dir.getFileHandle(name, { create: true });
    let writer,loaded=0;
    let stage:DiagnosticStage='copy';
    const action=new URL(descriptor.url,location.origin).pathname.startsWith('/_calendar_model_import/')?'import-gguf':'download-model';
    const sourceHash=action==='import-gguf'?sha256.create():undefined;
    try {
      recordDiagnosticAction(action,stage,undefined,{modelId:descriptor.id,expectedBytes:expected});
      writer = await modelFileWriter(handle, name);
      stage='stream-open';recordDiagnosticAction(action,stage,undefined,{modelId:descriptor.id,expectedBytes:expected});
      const response = await openModelDownload(descriptor.url,signal,expected);
      if (!response.body) throw new Error('model-download');
      const reader = response.body.getReader();
      stage='copy';recordDiagnosticAction(action,stage,undefined,{modelId:descriptor.id,expectedBytes:expected});
      try {
        while (true) {
          signal.throwIfAborted();
          const { value, done } = await reader.read().catch(error=>{if(signal.aborted||error instanceof Error&&error.message.startsWith('model-'))throw error;throw Error('model-download');}); if (done) break;
          loaded += value.byteLength; if (loaded > limit) throw new Error('model-size');
          sourceHash?.update(value);
          await writer.write(value); progress(loaded);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (expected!==undefined && loaded !== expected) throw new Error('model-download-incomplete');
      await writer.close();
      const file = await handle.getFile();stage='verify';recordDiagnosticAction(action,stage,undefined,{modelId:descriptor.id,bytes:loaded,expectedBytes:expected});
      if(sourceHash){
        const checksum=Array.from(sourceHash.digest(),b=>b.toString(16).padStart(2,'0')).join('');
        if(await modelChecksum(file,signal)!==checksum)throw Error('model-copy-checksum');
        copiedChecksums.set(file,checksum);
      }
      streamed.set(file,name);return file;
    } catch (error) {recordDiagnosticAction(action,'error',error,{modelId:descriptor.id,failedStage:stage,bytes:loaded,expectedBytes:expected});await writer?.abort().catch(() => {});await dir.removeEntry(name).catch(() => {});throw error;}
  }
  // Older file/WebView origins can import a file without buffering a large download in JS.
  if (new URL(descriptor.url,location.origin).pathname.startsWith('/_calendar_model_import/') || expected===undefined||expected > 512_000_000) throw new Error('model-stream-storage-unavailable');
  const response = await openModelDownload(descriptor.url,signal,expected);
  if (!response.body) throw new Error('model-download');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read().catch(error=>{if(signal.aborted||error instanceof Error&&error.message.startsWith('model-'))throw error;throw Error('model-download');});
      if (done) break;
      signal.throwIfAborted();
      loaded += value.byteLength;
      if (loaded > limit) throw new Error('model-size');
      chunks.push(value as Uint8Array<ArrayBuffer>);
      progress(loaded);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  chunks.length = 0;
  if(expected!==undefined&&blob.size!==expected)throw Error('model-download-incomplete');
  return blob;
}


// The build stages the exact verified weights beside this small metadata file.
// Availability is cheap; inference independently verifies the actual GGUF bytes.
export async function bundledModelAvailable(descriptor: ModelDescriptor = DEFAULT_MODEL): Promise<boolean> {
  if (!descriptor.bundled || !buildBundlesModel(BUILD_INFO)) return false;
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


export type ModelInstallationState = 'missing' | 'partial' | 'unverified' | 'verified' | 'unavailable' | 'damaged';
export interface ModelInstallationSnapshot { state: ModelInstallationState; bytes: number; error?: string }
/** Read installation evidence without deleting weights or treating a preference as an install.
 * New OPFS registrations are written only after SHA-256 verification. Legacy Blob
 * records and complete transfer files remain unverified until the runtime checks them.
 */
export async function modelInstallationState(descriptor: ModelDescriptor): Promise<ModelInstallationSnapshot> {
  try {
    await androidAIReady;
    const bridge = desktopAI();
    if (descriptor.imported && bridge?.registerImported) await bridge.registerImported(descriptor);
    const native = await bridge?.info(descriptor.id);
    if (native?.installed) return { state: native.bytes !== undefined && native.bytes !== descriptor.bytes ? 'damaged' : native.verified === true ? 'verified' : 'unverified', bytes: native.bytes ?? descriptor.bytes };
    let damaged = Boolean(native?.bytes);
    const db = await database();
    try {
      const record = await db.get('models', descriptor.id);
      if (record?.opfsName && typeof navigator.storage?.getDirectory === 'function') {
        try {
          const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
          const file = await (await dir.getFileHandle(record.opfsName)).getFile();
          if (file.size !== descriptor.bytes) damaged = true;
          else return { state: record.bytes === descriptor.bytes && record.sha256 === descriptor.sha256 ? 'verified' : 'unverified', bytes: file.size };
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
          damaged = true;
        }
      } else if (record instanceof Blob || record?.blob instanceof Blob) {
        const blob = record instanceof Blob ? record : record.blob;
        if (blob.size === descriptor.bytes) return { state: !(record instanceof Blob) && record.bytes === descriptor.bytes && record.sha256 === descriptor.sha256 ? 'verified' : 'unverified', bytes: blob.size };
        damaged = true;
      }
    } finally { db.close(); }
    if (descriptor.bundled && await bundledModelAvailable(descriptor)) return { state: 'unverified', bytes: descriptor.bytes };
    const transfer = hasNativeTransfers() && descriptor.url ? await nativeTransferStatus(descriptor) : undefined;
    if (transfer?.installed) return { state: transfer.verified === true ? 'verified' : 'unverified', bytes: transfer.totalBytes };
    const bytes = Math.max(transfer?.resumeBytes ?? 0, await modelTransferBytes(descriptor));
    if (bytes > 0) return { state: bytes === descriptor.bytes ? 'unverified' : 'partial', bytes };
    return { state: damaged ? 'damaged' : 'missing', bytes: 0 };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('model-') ? error.message : 'model-storage';
    return { state: ['model-size','model-checksum','model-gguf-invalid'].includes(code) ? 'damaged' : 'unavailable', bytes: 0, error: code };
  }
}


/** Persist only verification evidence for the exact legacy bytes read earlier.
 * Blob wrapping preserves the immutable data, and the token prevents a late
 * checksum result from blessing a concurrent same-size replacement.
 */
export async function markModelVerified(descriptor: ModelDescriptor, blob: Blob): Promise<boolean> {
  const source = verificationSources.get(blob);
  if (!source || source.id !== descriptor.id) return false;
  if (blob.size !== descriptor.bytes) throw Error('model-size');
  if ('opfsName' in source) {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
    const current = await (await dir.getFileHandle(source.opfsName)).getFile();
    if (current.size !== blob.size || current.lastModified !== source.modified) throw Error('model-storage');
  }
  const db = await database();
  try {
    const tx = db.transaction('models', 'readwrite');
    const current = await tx.store.get(descriptor.id);
    const matches = 'token' in source
      ? current?.verificationToken === source.token && current.blob instanceof Blob && current.blob.size === blob.size
      : current?.opfsName === source.opfsName;
    if (!matches) { await tx.done; throw Error('model-storage'); }
    await tx.store.put({...current,bytes:descriptor.bytes,sha256:descriptor.sha256},descriptor.id);
    await tx.done;
    return true;
  } finally { db.close(); }
}
