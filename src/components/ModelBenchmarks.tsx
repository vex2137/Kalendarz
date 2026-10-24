import { useEffect, useRef, useState } from "react";
import type { AppLanguage } from "../utils/i18n";
import { tr } from "../utils/i18n";
import { assistantUiText } from "../utils/assistantUiText";
import {
  runAssistantBenchmark,
  storedBenchmarkRuns,
  summarizeBenchmarkRun,
  type BenchmarkMode,
  type BenchmarkRun,
} from "../utils/assistantBenchmarks";
import { findModel } from "../utils/modelRegistry";
import type { ModelMetric } from "../utils/modelDiagnostics";

export function ModelBenchmarks({
  language,
  disabled,
}: {
  language: AppLanguage;
  disabled: boolean;
}) {
  const text = assistantUiText(language);
  const [mode, setMode] = useState<BenchmarkMode>("llm"),
    [preset, setPreset] = useState<BenchmarkRun["preset"]>("smoke");
  const [runs, setRuns] = useState<BenchmarkRun[]>([]),
    [progress, setProgress] = useState<BenchmarkRun>(),
    [error, setError] = useState(false);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    void storedBenchmarkRuns()
      .then(setRuns)
      .catch(() => setError(true));
    return () => controller.current?.abort();
  }, []);
  const start = async (resume?: BenchmarkRun) => {
    if (controller.current) return;
    const abort = (controller.current = new AbortController());
    setRunning(true);
    setError(false);
    try {
      const result = await runAssistantBenchmark({
        mode: resume?.mode || mode,
        preset: resume?.preset || preset,
        signal: abort.signal,
        resume,
        onProgress: setProgress,
      });
      setRuns((rows) => [
        result,
        ...rows.filter((row) => row.id !== result.id),
      ]);
    } catch {
      setError(true);
    } finally {
      controller.current = undefined;
      setRunning(false);
    }
  };
  const exportRun = (run: BenchmarkRun) => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...run, summary: summarizeBenchmarkRun(run) },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `calendar-benchmark-${run.modelId}-${run.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const busy = running;
  return (
    <section className="mt-3 space-y-2" aria-label={text.benchmark}>
      <h4 className="font-semibold">{text.benchmark}</h4>
      <p>
        {tr(
          language,
          "Wyłącznie publiczne przypadki testowe i fikcyjny kalendarz. Bez zapisu wydarzeń. Pełny test: 100 PL + 100 EN. Ocena rozmowy wymaga także przeglądu człowieka.",
          "Public test fixtures and a synthetic calendar only. No event writes. Full test: 100 PL + 100 EN. Conversation quality also requires human review.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={text.benchmark}
          value={mode}
          disabled={busy}
          onChange={(event) => setMode(event.target.value as BenchmarkMode)}
          className="theme-input rounded p-2"
        >
          <option value="llm">
            LLM · {tr(language, "bez parsera", "without parser")}
          </option>
          <option value="rules">
            {tr(language, "Tylko reguły", "Rules only")}
          </option>
          <option value="assistant">
            {tr(language, "Cały asystent", "Full assistant")}
          </option>
        </select>
        <select
          aria-label={tr(language, "Zestaw prób", "Test set")}
          value={preset}
          disabled={busy}
          onChange={(event) =>
            setPreset(event.target.value as BenchmarkRun["preset"])
          }
          className="theme-input rounded p-2"
        >
          <option value="smoke">10 · PL/EN</option>
          <option value="corpus">200 · PL/EN</option>
          <option value="stability">
            40 · {tr(language, "stabilność", "stability")}
          </option>
        </select>
        <button
          type="button"
          disabled={disabled || busy}
          className="theme-border border rounded p-2 disabled:opacity-50"
          onClick={() => {
            void start();
          }}
        >
          {text.run}
        </button>
        {busy && (
          <button
            type="button"
            className="theme-border border rounded p-2"
            onClick={() => controller.current?.abort()}
          >
            {text.cancel}
          </button>
        )}
      </div>
      {progress && (
        <p role="status">
          {findModel(progress.modelId).name} · {progress.status} ·{" "}
          {progress.nextIndex}
        </p>
      )}
      {error && (
        <p role="alert">
          {tr(
            language,
            "Test nie został ukończony. Zachowane wyniki można wyeksportować.",
            "Test did not finish. Saved results remain available for export.",
          )}
        </p>
      )}
      <p className="theme-muted">
        {tr(
          language,
          "PSS i CPU aplikacji nie obejmują odizolowanego procesu WebView. Brakujące pomiary mają wartość null. Szacowanego RAM nie traktuj jako pomiaru.",
          "App PSS and CPU exclude the isolated WebView renderer. Missing measurements are null. RAM estimates are not measurements.",
        )}
      </p>
      <div className="overflow-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th>{text.models}</th>
              <th>
                {tr(language, "Sprawdzenia automatyczne", "Automated checks")}
              </th>
              <th>TTFT ms</th>
              <th>tok/s</th>
              <th>App PSS MiB*</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 20).map((run) => {
              const metrics = run.results
                .map((row) => row.metric as ModelMetric | undefined)
                .filter((m): m is ModelMetric => Boolean(m));
              const complete = run.results.filter(
                (row) =>
                  Object.keys(row.checks).length > 0 &&
                  Object.values(row.checks).every(Boolean),
              ).length;
              const summary = summarizeBenchmarkRun(run);
              return (
                <tr key={run.id}>
                  <td>
                    {findModel(run.modelId).name}
                    <br />
                    {run.mode} · {run.status}
                  </td>
                  <td>
                    {complete}/{run.results.length}
                    <br />
                    {tr(language, "Do oceny ręcznej", "Manual review")}:{" "}
                    {run.results.filter((r) => r.semanticReviewRequired).length}
                  </td>
                  <td>
                    {metrics[0]?.firstTokenMs === undefined
                      ? "—"
                      : Math.round(metrics[0].firstTokenMs)}
                  </td>
                  <td>
                    {summary.nativeTokensPerSecondWeighted?.toFixed(1) ?? "—"}
                  </td>
                  <td>
                    {summary.appPeakPssKB === null
                      ? "—"
                      : (summary.appPeakPssKB / 1024).toFixed(1)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => exportRun(run)}
                    >
                      {text.exportResults}
                    </button>
                    {run.status === "stopped" && (
                      <button
                        type="button"
                        disabled={disabled || busy}
                        className="underline block"
                        onClick={() => {
                          void start(run);
                        }}
                      >
                        {tr(language, "Wznów", "Resume")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
