/// <reference lib="webworker" />
// Android WebView may expose OPFS without createWritable. Its synchronous API
// is available only in a dedicated worker; transfer bounded chunks, never weights.
let directory: FileSystemDirectoryHandle;
let file: FileSystemSyncAccessHandle | undefined;
let name: string;
let offset = 0;
self.onmessage = async ({ data }) => {
  try {
    if (data.action === 'open') {
      directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models', { create: true });
      name = data.name;
      file = await (await directory.getFileHandle(name, { create: true })).createSyncAccessHandle();
    } else if (data.action === 'write') {
      const bytes = new Uint8Array(data.bytes);
      let written = 0;
      while (written < bytes.length) {
        const count = file!.write(bytes.subarray(written), { at: offset + written });
        if (!count) throw new Error('model-storage-space');
        written += count;
      }
      offset += written;
    } else if (data.action === 'close') {
      file!.flush(); file!.close(); file = undefined;
    } else if (data.action === 'abort') {
      file?.close(); file = undefined;
      await directory?.removeEntry(name).catch(() => {});
    }
    self.postMessage({ id: data.id });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'model-storage', name: error instanceof Error ? error.name : 'Error' });
  }
};
export {};
