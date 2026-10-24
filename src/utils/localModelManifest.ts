// Bundled default GGUF, pinned and verified in builds and before inference.
import manifest from './localModelManifest.json';
export const LOCAL_MODEL = manifest;

export function bundledModelUrl(file: string) {
  const url = new URL(`models/${file}`, document.baseURI);
  return url.protocol === 'file:' ? `calendar-asset://models/${file}` : url.href;
}
