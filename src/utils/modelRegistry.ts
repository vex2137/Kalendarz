import fallback from './localModelManifest.json';
import optionalModels from './optionalModels.json';
import fineTunedModels from './fineTunedModels.json';
import { BUILD_INFO } from './buildInfo';

export interface ModelDescriptor {
  id: string; name: string; file: string; bytes: number; sha256: string; revision: string;
  url: string; license: string; licenseName: string; architecture: string; quantization: string;
  estimatedRamMB: number; maxContext: number; bundled?: boolean; experimental?: boolean; external?: boolean; imported?: boolean;
}
export const DEFAULT_MODEL: ModelDescriptor = { ...fallback, bundled: BUILD_INFO.bundledModel !== false };
// Only measured, published artifacts belong here; local experiments use GGUF import.
export const AI_MODELS: readonly ModelDescriptor[] = [DEFAULT_MODEL, ...optionalModels, ...fineTunedModels];
export const OPTIONAL_FALLBACK = AI_MODELS.find(model => model.id === 'lfm2.5-350m-q4-k-m')!;
const externalKey='calendar_external_ai_models_v1';
let externalModels:ModelDescriptor[]=[];
export function registerExternalModels(models:ModelDescriptor[]){
  externalModels=models.filter(m=>m.external===true&&/^external-[a-f0-9]{32}$/.test(m.id)&&typeof m.name==='string'&&Number.isSafeInteger(m.bytes)&&m.bytes>0&&typeof m.architecture==='string'&&Number.isFinite(m.maxContext));
  try{localStorage.setItem(externalKey,JSON.stringify(externalModels));}catch{}
}
try{const saved=JSON.parse(localStorage.getItem(externalKey)||'[]');if(Array.isArray(saved))registerExternalModels(saved);}catch{}
export const externalModelChoices=()=>externalModels;
const importedKey = 'calendar_imported_ai_models_v1';
let importedModels: ModelDescriptor[] = [];
export function registerImportedModel(model: ModelDescriptor) {
  if (!validImportedModel(model)) throw Error('model-input');
  const next = [...importedModels.filter(m => m.id !== model.id), model];
  localStorage.setItem(importedKey, JSON.stringify(next));
  importedModels = next;
}
function validImportedModel(m: ModelDescriptor) {
  return m?.imported === true && /^imported-[a-f0-9]{64}$/.test(m.id) && m.id === 'imported-' + m.sha256 && Number.isSafeInteger(m.bytes) && m.bytes > 24 && m.bytes <= 16 * 1024 ** 3 && typeof m.name === 'string' && m.name.length <= 200 && /^[a-z0-9_]{1,64}$/.test(m.architecture) && Number.isInteger(m.maxContext) && m.maxContext >= 1 && m.maxContext <= 2048 && m.url === '' && !m.external && !m.bundled;
}
try { const models = JSON.parse(localStorage.getItem(importedKey) || '[]'); if (Array.isArray(models)) importedModels = models.filter(validImportedModel).slice(0,128); } catch {}
export const modelChoices = () => [...AI_MODELS, ...importedModels];
export const findModel = (id?: string) => modelChoices().find(model => model.id === id) || externalModels.find(model=>model.id===id) || DEFAULT_MODEL;
export const PREFERRED_MODEL = DEFAULT_MODEL;
export const shortModelName = (model: ModelDescriptor) => model.name.replace(` ${model.quantization}`, '');
const selectionKey = 'calendar_active_ai_model_v1';
export function hasModelSelection() { try { return Boolean(localStorage.getItem(selectionKey)); } catch { return false; } }
export function activeModel() { try { return findModel(localStorage.getItem(selectionKey) || undefined); } catch { return DEFAULT_MODEL; } }
export function persistModelSelection(model: ModelDescriptor) { localStorage.setItem(selectionKey, model.id); }
