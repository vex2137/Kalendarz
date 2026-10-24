import fallback from './localModelManifest.json';

export interface ModelDescriptor {
  id: string; name: string; file: string; bytes: number; sha256: string; revision: string;
  url: string; license: string; licenseName: string; architecture: string; quantization: string;
  estimatedRamMB: number; maxContext: number; bundled?: boolean; experimental?: boolean;
}
export const DEFAULT_MODEL: ModelDescriptor = { ...fallback, licenseName: 'LFM1.0', architecture: 'lfm2', quantization: 'Q4_K_M', estimatedRamMB: 650, maxContext: 2048, bundled: true };
const lfmRevision = 'e7caca5d835a3901a8e0d63e94009429bafafdfc';
const qwenRevision = '78fc4c891ff7dee2e8286c3f4cdc8a26f7544a07';
const qwen = { revision: qwenRevision, license: 'https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE', licenseName: 'Apache-2.0', architecture: 'qwen35', estimatedRamMB: 1600, maxContext: 2048, experimental: true };
export const AI_MODELS: readonly ModelDescriptor[] = [DEFAULT_MODEL, {
  id: 'lfm2.5-2.6b-q4-k-m', name: 'LFM2.5 2.6B Q4_K_M', file: 'LFM2.5-2.6B-Q4_K_M.gguf',
  revision: lfmRevision, bytes: 1674455040, sha256: '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed',
  url: `https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/resolve/${lfmRevision}/LFM2.5-2.6B-Q4_K_M.gguf`,
  license: `https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/${lfmRevision}/LICENSE`, licenseName: 'LFM1.0', architecture: 'lfm2', quantization: 'Q4_K_M', estimatedRamMB: 3200, maxContext: 2048, experimental: true,
}, ...([
  ['qwen3.5-0.8b-q4-k-m', 'Q4_K_M', 527503680, '2c49cd8cb9c15a451dd6087b8ae9676f1fc2556501bb0717cc1ba3fcae413c27'],
  ['qwen3.5-0.8b-iq4-xs', 'IQ4_XS', 488114496, '69b1c57926ade7ce1c5fa49cd5d722c626552f25fc9f9e2b1d6892f3454719a3'],
] as const).map(([id, quantization, bytes, sha256]) => ({ ...qwen, id, name: `Qwen3.5 0.8B ${quantization}`, quantization, bytes, sha256, file: `Qwen3.5-0.8B.${quantization}.gguf`, url: `https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF/resolve/${qwenRevision}/Qwen3.5-0.8B.${quantization}.gguf` }))];
export const findModel = (id?: string) => AI_MODELS.find(model => model.id === id) || DEFAULT_MODEL;
export const PREFERRED_MODEL = AI_MODELS.find(model => model.id === 'qwen3.5-0.8b-q4-k-m')!;
export const shortModelName = (model: ModelDescriptor) => model.name.replace(` ${model.quantization}`, '');
const selectionKey = 'calendar_active_ai_model_v1';
export function hasModelSelection() { try { return Boolean(localStorage.getItem(selectionKey)); } catch { return false; } }
export function activeModel() { try { return findModel(localStorage.getItem(selectionKey) || undefined); } catch { return DEFAULT_MODEL; } }
export function persistModelSelection(model: ModelDescriptor) { localStorage.setItem(selectionKey, model.id); }
