import { sha256 } from '@noble/hashes/sha2.js';
import { modelFileWriter } from './modelFileWriter';
import type { ModelDescriptor } from './modelRegistry';

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const strongETag = (value: string | null) => value && /^"[^\r\n]*"$/.test(value) ? value : undefined;
const checkpoint = 4 * 1024 * 1024;
export function transferName(model: ModelDescriptor) {
  return 'transfer-' + hex(sha256(new TextEncoder().encode(JSON.stringify([model.id, model.url, model.bytes, model.sha256]))));
}
export async function removeModelTransfer(model: ModelDescriptor) {
  const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', {create:true});
  const key = transferName(model);
  for (const suffix of ['.gguf', '.json']) await dir.removeEntry(key + suffix).catch(error => {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
  });
}

/** Same OPFS transfer used by installation; no unverified bytes enter the model registry. */
export async function resumableModelTransfer(model: ModelDescriptor, signal: AbortSignal,
  progress: (bytes: number) => void, verify: (file: File) => Promise<void>,
  space: (bytes: number) => Promise<void>, timeoutMs = 45000): Promise<File> {
  if (!Number.isSafeInteger(model.bytes) || model.bytes <= 0 || !/^[a-f0-9]{64}$/i.test(model.sha256)) throw Error('model-input');
  const key = transferName(model);
  const transfer = async () => {
    signal.throwIfAborted();
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', {create:true});
    const handle = await dir.getFileHandle(key + '.gguf', {create:true});
    let etag: string | undefined, loaded = (await handle.getFile()).size;
    try {
      const saved = JSON.parse(await (await (await dir.getFileHandle(key + '.json')).getFile()).text());
      if (saved.key === key) etag = strongETag(saved.etag) || undefined;
    } catch { /* Missing/torn metadata cannot authorize a Range request. */ }
    const reset = async () => {
      const writer = await modelFileWriter(handle, key + '.gguf');
      try { await writer.close(); } catch (error) { await writer.abort().catch(() => {}); throw error; }
      loaded = 0; etag = undefined;
    };
    if (loaded > model.bytes || (loaded && !etag && loaded !== model.bytes)) await reset();
    if (loaded === model.bytes) {
      const file = await handle.getFile();
      try { await verify(file); signal.throwIfAborted(); progress(loaded); return file; }
      catch (error) {
        if (!signal.aborted && error instanceof Error && ['model-checksum','model-size'].includes(error.message)) await removeModelTransfer(model);
        throw error;
      }
    }
    signal.throwIfAborted();
    try { await space(model.bytes - loaded); }
    catch (error) { if (!loaded) await removeModelTransfer(model); throw error; }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, {once:true});
    let timer: ReturnType<typeof setTimeout> | undefined, timedOut = false;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs); };
    let writer: Awaited<ReturnType<typeof modelFileWriter>> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let committed = loaded;
    try {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        signal.throwIfAborted(); arm();
        response = await fetch(model.url, {signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer',
          headers: loaded ? {Range:`bytes=${loaded}-`, 'If-Range':etag!} : {}});
        if (response.status === 200) { if (loaded) await reset(); break; }
        if (response.status === 206) {
          const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
          const tag = strongETag(response.headers.get('ETag'));
          if (range && Number(range[1]) === loaded && Number(range[2]) === model.bytes - 1 && Number(range[3]) === model.bytes && (!loaded || (etag && tag === etag))) break;
        } else if (response.status !== 416) throw Error(`model-http-${response.status}`);
        await response.body?.cancel(); response = undefined;
        if (attempt) throw Error('model-download-range');
        await reset();
      }
      if (!response?.body) throw Error('model-download');
      if (response.headers.get('Content-Encoding') && response.headers.get('Content-Encoding') !== 'identity') throw Error('model-download-range');
      const length = response.headers.get('Content-Length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) !== model.bytes - loaded)) throw Error('model-download-range');
      etag = strongETag(response.headers.get('ETag')) || undefined;
      // Commit validator before data. Actual file length is the durable offset, never the journal's claim.
      const journal = await modelFileWriter(await dir.getFileHandle(key + '.json', {create:true}), key + '.json');
      try { await journal.write(new TextEncoder().encode(JSON.stringify({key, etag}))); await journal.close(); }
      catch (error) { await journal.abort().catch(() => {}); throw error; }
      committed = loaded;
      writer = await modelFileWriter(handle, key + '.gguf', loaded);
      progress(loaded); reader = response.body.getReader();
      while (true) {
        signal.throwIfAborted(); arm();
        const {done, value} = await reader.read();
        if (done) break;
        if (loaded + value.byteLength > model.bytes) throw Error('model-size');
        await writer.write(value as Uint8Array<ArrayBuffer>); loaded += value.byteLength; progress(loaded);
        if (loaded - committed >= checkpoint) {
          await writer.close(); writer = undefined; committed = loaded;
          writer = await modelFileWriter(handle, key + '.gguf', loaded);
        }
      }
      await writer.close(); writer = undefined;
      if (loaded !== model.bytes) throw Error('model-download-incomplete');
      clearTimeout(timer);
      const file = await handle.getFile(); await verify(file); signal.throwIfAborted(); return file;
    } catch (error) {
      // Commit only successfully written data. Transactional writers roll back on quota/write failure.
      if (writer) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') await writer.abort().catch(() => {});
        else await writer.close().catch(() => writer?.abort().catch(() => {}));
      }
      const remaining = await handle.getFile().then(file => file.size).catch(() => 0);
      if (!remaining || error instanceof Error && ['model-checksum','model-size'].includes(error.message)) await removeModelTransfer(model);
      if (signal.aborted) throw signal.reason;
      if (timedOut) throw Error('model-download-timeout');
      if (error instanceof TypeError) throw Error('model-download');
      throw error;
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      await reader?.cancel().catch(() => {}); reader?.releaseLock();
    }
  };
  if (navigator.locks) return navigator.locks.request(key, {ifAvailable:true}, lock => {
    if (!lock) throw Error('model-busy');
    return transfer();
  });
  return transfer();
}

export async function modelTransferBytes(model: ModelDescriptor): Promise<number> {
  if (typeof navigator.storage?.getDirectory !== 'function') return 0;
  try {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');
    const file = await (await dir.getFileHandle(transferName(model) + '.gguf')).getFile();
    return file.size <= model.bytes ? file.size : 0;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return 0;
    throw error;
  }
}
