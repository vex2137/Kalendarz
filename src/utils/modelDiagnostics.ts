export interface ModelMetric {
  route: 'model' | 'rules' | 'quick' | 'preload'; totalMs: number; loadMs?: number; error?: 'cancelled' | 'inference';
  storageMs?: number; verifyMs?: number; initMs?: number; firstTokenMs?: number;
  promptMs?: number; generationMs?: number; tokensPerSecond?: number;
  promptTokens?: number; cachedTokens?: number; completionTokens?: number;
  threads?: number; multithread?: boolean; isolated?: boolean;
}
let metrics: ModelMetric[] = [];
const listeners = new Set<() => void>();
export const modelMetrics = () => metrics;
export const subscribeMetrics = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function recordModelMetric(metric: ModelMetric) {
  metrics = [...metrics.slice(-29), metric];
  listeners.forEach(fn => fn());
}
export function runtimeCapabilities() {
  const wasm = WebAssembly as typeof WebAssembly & { Suspending?: unknown };
  return { isolated: globalThis.crossOriginIsolated === true, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined', jspi: typeof wasm.Suspending === 'function', hardwareConcurrency: navigator.hardwareConcurrency || 1, deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, userAgent: navigator.userAgent };
}
export function diagnosticsReport() {
  return { version: 1, capabilities: runtimeCapabilities(), metrics };
}
