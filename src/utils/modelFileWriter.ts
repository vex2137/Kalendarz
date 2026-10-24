// Both implementations write to OPFS with bounded memory, including WebViews
// that implement only createSyncAccessHandle in dedicated workers.
export async function modelFileWriter(handle: FileSystemFileHandle, name: string) {
  if (typeof handle.createWritable === 'function') return handle.createWritable();
  const worker = new Worker(new URL('./modelStorageWorker.ts', import.meta.url), { type: 'module' });
  let sequence = 0;
  let closed = false;
  const request = (action: string, bytes?: ArrayBuffer) => new Promise<void>((resolve, reject) => {
    const id = ++sequence;
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.error) reject(new DOMException(data.error, data.name)); else resolve();
    };
    worker.onerror = () => reject(new Error('model-stream-storage-unavailable'));
    worker.postMessage({ id, action, name, bytes }, bytes ? [bytes] : []);
  });
  try { await request('open'); } catch (error) { worker.terminate(); throw error; }
  return {
    write: async (chunk: ArrayBuffer | Uint8Array<ArrayBuffer>) => {
      const bytes = chunk instanceof ArrayBuffer ? chunk : chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      await request('write', bytes);
    },
    close: async () => { await request('close'); closed = true; worker.terminate(); },
    abort: async () => { if (!closed) try { await request('abort'); } finally { closed = true; worker.terminate(); } },
  };
}
