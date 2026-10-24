import type { ModelMetric } from "./modelDiagnostics";
import type { BenchmarkRun } from "./assistantBenchmarks";

export function summarizeBenchmarkRun(run: BenchmarkRun) {
  const metrics = run.results
    .map((result) => result.metric as ModelMetric | undefined)
    .filter((metric): metric is ModelMetric => Boolean(metric));
  const totalGenerationMs = metrics.reduce(
    (sum, metric) => sum + (metric.generationMs || 0),
    0,
  );
  const nativeRateWeighted = metrics.reduce(
    (sum, metric) =>
      sum + (metric.tokensPerSecond || 0) * (metric.generationMs || 0),
    0,
  );
  const modelResponses = run.results.filter((result) => Boolean(result.metric));
  const errors: Record<string, number> = {};
  for (const result of run.results)
    if (result.error) errors[result.error] = (errors[result.error] || 0) + 1;
  const nativeSamples = (run.samples as { native?: Record<string, unknown> }[])
    .map((s) => s.native)
    .filter((s): s is Record<string, unknown> => Boolean(s));
  const appCpuPercent: number[] = [];
  for (let i = 1; i < nativeSamples.length; i++) {
    const a = nativeSamples[i - 1],
      b = nativeSamples[i];
    if (
      typeof a.cpuTimeMs === "number" &&
      typeof b.cpuTimeMs === "number" &&
      typeof a.elapsedRealtimeMs === "number" &&
      typeof b.elapsedRealtimeMs === "number" &&
      b.elapsedRealtimeMs > a.elapsedRealtimeMs &&
      b.cpuTimeMs >= a.cpuTimeMs
    )
      appCpuPercent.push(
        ((b.cpuTimeMs - a.cpuTimeMs) /
          (b.elapsedRealtimeMs - a.elapsedRealtimeMs)) *
          100,
      );
  }
  const counterDelta = (key: string) => {
    const a = nativeSamples[0]?.[key],
      b = nativeSamples.at(-1)?.[key];
    return typeof a === "number" && typeof b === "number" ? a - b : null;
  };
  return {
    executed: run.results.length,
    automatedCasesPassed: run.results.filter(
      (r) =>
        Object.keys(r.checks).length > 0 &&
        Object.values(r.checks).every(Boolean),
    ).length,
    manualReviewPending: run.results.filter((r) => r.semanticReviewRequired)
      .length,
    actualModelCalls: metrics.length,
    firstResponseMs: modelResponses[0]?.elapsedMs ?? null,
    nextResponsesMeanMs:
      modelResponses.length > 1
        ? modelResponses.slice(1).reduce((n, r) => n + r.elapsedMs, 0) /
          (modelResponses.length - 1)
        : null,
    firstTokenMs: metrics[0]?.firstTokenMs ?? null,
    firstAnswerTokenMs: metrics[0]?.firstAnswerTokenMs ?? null,
    nativeTokensPerSecondWeighted: totalGenerationMs
      ? nativeRateWeighted / totalGenerationMs
      : null,
    appPeakPssKB: run.peaks?.appPssKB ?? null,
    loadingAppPeakPssKB: run.peaks?.loadingAppPssKB ?? null,
    generatingAppPeakPssKB: run.peaks?.generatingAppPssKB ?? null,
    rendererPeakPssKB: null,
    totalInferenceCpuPercent: null,
    jsHeapPeakBytes: run.peaks?.jsHeapBytes ?? null,
    batteryTemperaturePeakC: run.peaks?.batteryTemperatureC ?? null,
    appCpuPercentOneCorePeak: appCpuPercent.length
      ? Math.max(...appCpuPercent)
      : null,
    wholeDeviceChargeDeltaMicroAh: counterDelta("batteryChargeMicroAh"),
    wholeDeviceEnergyDeltaNanoWh: counterDelta("batteryEnergyNanoWh"),
    scope:
      "App PSS excludes isolated WebView renderer; use optional ADB sampling for explicit renderer PIDs. Automatic pass counts are not human semantic quality scores.",
    errors,
  };
}
