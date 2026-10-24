import fallback from './localModelManifest.json';
import optionalModels from './optionalModels.json';

export interface ModelDescriptor {
  id: string; name: string; file: string; bytes: number; sha256: string; revision: string;
  url: string; license: string; licenseName: string; architecture: string; quantization: string;
  estimatedRamMB: number; maxContext: number; bundled?: boolean; experimental?: boolean;
}
export const DEFAULT_MODEL: ModelDescriptor = { ...fallback, bundled: true };
export const AI_MODELS: readonly ModelDescriptor[] = [DEFAULT_MODEL, ...optionalModels];
export const OPTIONAL_FALLBACK = AI_MODELS.find(model => model.id === 'lfm2.5-350m-q4-k-m')!;
export const findModel = (id?: string) => AI_MODELS.find(model => model.id === id) || DEFAULT_MODEL;
export const PREFERRED_MODEL = DEFAULT_MODEL;
export const shortModelName = (model: ModelDescriptor) => model.name.replace(` ${model.quantization}`, '');
const selectionKey = 'calendar_active_ai_model_v1';
export function hasModelSelection() { try { return Boolean(localStorage.getItem(selectionKey)); } catch { return false; } }
export function activeModel() { try { return findModel(localStorage.getItem(selectionKey) || undefined); } catch { return DEFAULT_MODEL; } }
export function persistModelSelection(model: ModelDescriptor) { localStorage.setItem(selectionKey, model.id); }
