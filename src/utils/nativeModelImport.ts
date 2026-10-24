import { registerPlugin } from '@capacitor/core';
export interface NativeModelFile { token: string; name: string; bytes: number; cancelled?: boolean }
const importer = registerPlugin<{
  pick: () => Promise<NativeModelFile>;
  release: (options: { token: string }) => Promise<void>;
}>('CalendarModelImport');
export const pickNativeModel = () => importer.pick();
export const releaseNativeModel = (token: string) => importer.release({ token });
export function nativeModelUrl(token: string) {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('model-import-file');
  return new URL(`/_calendar_model_import/${token}`, location.origin).href;
}
