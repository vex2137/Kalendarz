import fixture from "../../tests/fixtures/assistant-bilingual-v2.tsv?raw";
import appPackage from "../../package.json";
import { openDB } from "idb";
import { Capacitor } from "@capacitor/core";
import { CalendarDevice } from "./nativeDevice";
import { DEFAULT_MODEL, findModel } from "./modelRegistry";
import {
  cancelModelOperation,
  inferCalendarJson,
  inferLocalText,
  modelStatus,
  unloadLocalModel,
} from "./localModelRuntime";
import { assistantQuickReply } from "./assistantQuickReply";
import { parseCalendarCommand, fold } from "./calendarCommandParser";
import { matchesCalendarText } from "./assistantPlanning";
import { minutes, timeString } from "./dates";
import {
  assistantSystemPrompt,
  ASSISTANT_SCHEMA,
  parseModelCommand,
} from "./modelCommand";
import { runModelAssistant, type ModelConversation } from "./modelAssistant";
import { DEFAULT_PLANNING } from "./assistantPlanning";
import {
  assistantTurns,
  diagnosticsReport,
  modelMetrics,
  type ModelMetric,
} from "./modelDiagnostics";
import type { AppLanguage } from "./i18n";
import type { CalendarEvent } from "../types";

export const BILINGUAL_CASES = fixture
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [id, category, pl, en, action] = line.split("\t");
    return { id, category, pl, en, action };
  });
export const BENCHMARK_REFERENCE = "2026-10-24T10:00:00";
export type BenchmarkMode = "llm" | "rules" | "assistant";
export interface BenchmarkResult {
  caseId: string;
  language: "pl" | "en";
  route: string;
  elapsedMs: number;
  checks: Record<string, boolean>;
  semanticReviewRequired: boolean;
  response?: string;
  error?: string;
  metric?: unknown;
}
export interface BenchmarkRun {
  id: string;
  createdAt: number;
  modelId: string;
  mode: BenchmarkMode;
  preset: "smoke" | "corpus" | "stability";
  status: "running" | "stopped" | "complete";
  nextIndex: number;
  conditions: unknown;
  samples: unknown[];
  peaks?: Record<string, number>;
  stopReason?: string;
  results: BenchmarkResult[];
}
const database = () =>
  openDB("calendar-ai-benchmarks", 1, {
    upgrade(db) {
      db.createObjectStore("runs", { keyPath: "id" });
    },
  });
export async function storedBenchmarkRuns(): Promise<BenchmarkRun[]> {
  const db = await database();
  try {
    return (await db.getAll("runs"))
      .map((run) =>
        run.status === "running"
          ? { ...run, status: "stopped", stopReason: "interrupted" }
          : run,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}
async function storeRun(run: BenchmarkRun) {
  const db = await database();
  try {
    await db.put("runs", structuredClone(run));
  } finally {
    db.close();
  }
}
export async function deviceTelemetry() {
  const native =
    Capacitor.getPlatform() === "android"
      ? await CalendarDevice.benchmarkTelemetry().catch(() => ({
          unavailable: true,
        }))
      : undefined;
  const heap = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    }
  ).memory;
  return {
    at: Date.now(),
    modelId: modelStatus().modelId,
    phase: modelStatus().phase,
    native,
    jsHeapBytes: heap?.usedJSHeapSize ?? null,
    rendererPssBytes: null,
    totalInferenceCpuPercent: null,
    wholeDeviceEnergyConsumed: null,
  };
}
const syntheticEvents = (): CalendarEvent[] =>
  [
    ["Yoga", "07:00", "08:00"],
    ["Dentist", "10:00", "11:00"],
    ["Lunch", "12:00", "13:00"],
  ].map(([title, startTime, endTime], index) => ({
    id: `benchmark-${index}`,
    title,
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    startTime,
    endTime,
    allDay: false,
    color: "peacock",
    recurrence: "NONE",
    reminders: [],
    createdAt: 1,
    updatedAt: 1,
  }));
const expectedFields: Record<string, Record<string, unknown>> = {
  "016": { date: "2026-10-30", time: "09:00" },
  "017": { date: "2026-11-02", time: "16:20" },
  "018": { date: "2026-10-25", time: "07:30" },
  "019": { date: "2026-10-28", time: "18:00" },
  "020": { date: "2026-11-12", allDay: true },
  "021": { date: "2026-10-25", time: "12:00" },
  "022": { date: "2026-10-24", time: "19:45" },
  "023": { date: "2026-10-26", time: "11:00" },
  "024": { date: "2026-10-26", time: "17:00", endTime: "18:30" },
  "025": { date: "2026-10-28", time: "08:00" },
  "026": { date: "2026-10-25", time: "10:00" },
  "027": { date: "2026-10-25", time: "13:00" },
  "028": { time: "16:00", recurrence: "WEEKLY" },
  "029": { date: "2026-10-25", time: "20:00" },
  "030": { date: "2026-10-25", time: "15:00" },
  "031": { date: "2026-10-26", time: "09:10" },
  "032": { date: "2026-12-01", time: "14:05" },
  "033": { date: "2026-11-05", time: "18:15", endTime: "20:00" },
  "034": { date: "2026-10-31", time: "10:00" },
  "035": { date: "2026-10-26", time: "00:00" },
  "036": { query: "Yoga", date: "2026-10-26", time: "18:00" },
  "037": { query: "Dentist", date: "2026-10-27", time: "12:30" },
  "039": { query: "Yoga", time: "07:45" },
  "041": { query: "Dentist" },
  "043": { query: "Dentist", date: "2026-10-28", time: "17:00" },
  "045": { query: "Yoga", endTime: "09:15" },
  "046": { query: "Lunch", date: "2026-11-03" },
  "047": { query: "Dentist", date: "2026-10-30", time: "14:00" },
  "048": { query: "Yoga", date: "2026-10-26", time: "08:00" },
  "049": { query: "Lunch", time: "13:30" },
  "086": { query: "Yoga", date: "2026-10-26" },
  "087": { query: "Yoga", time: "10:15" },
  "090": { query: "Yoga" },
  "093": { query: "Yoga", date: "2026-10-26" },
};
const titlePairs: Record<string, readonly [string, string]> = {
  "016": ["sprawdzian z matmy", "maths test"],
  "017": ["wizyta u optyka", "optician appointment"],
  "018": ["jogging", "jogging"],
  "019": ["chór", "choir"],
  "020": ["wolne", "day off"],
  "021": ["śniadanie", "breakfast"],
  "022": ["telefon do mamy", "call to mum"],
  "023": ["Plan na jutro", "Plan for tomorrow"],
  "024": ["basen", "swimming"],
  "025": ["trening siłowy", "strength training"],
  "026": ["spotkanie zespołu", "team meeting"],
  "027": ["przegląd roweru", "bicycle check"],
  "028": ["korepetycje", "tutoring"],
  "029": ["herbata", "tea"],
  "030": ["spacer", "walk"],
  "031": ["odbiór paczki", "parcel pickup"],
  "032": ["Księgarnia", "Bookshop"],
  "033": ["Wystawa", "Exhibition"],
  "034": ["sprzątanie", "cleaning"],
  "035": ["Start", "Start"],
  "038": ["Obiad zespołu", "Team lunch"],
  "090": ["Poranna Yoga", "Morning Yoga"],
};
const durationMinutes: Record<string, number> = {
  "019": 90,
  "022": 15,
  "028": 60,
  "029": 20,
  "034": 120,
};
const deletionTitles: Record<string, string> = {
  "051": "Yoga",
  "052": "Dentist",
  "053": "Lunch",
  "054": "Yoga",
  "055": "Lunch",
  "056": "Dentist",
  "057": "Lunch",
  "058": "Yoga",
  "059": "Lunch",
  "060": "Dentist",
};
export function scoreBenchmarkCommand(
  id: string,
  expectedAction: string,
  actual: Record<string, unknown> | undefined,
  language: "pl" | "en" = "pl",
) {
  const allowed =
    expectedAction === "search"
      ? ["search", "assistant"]
      : expectedAction === "clarify"
        ? ["clarify"]
        : [expectedAction];
  const checks: Record<string, boolean> = {
    intent: Boolean(actual && allowed.includes(String(actual.action))),
  };
  const title = titlePairs[id]?.[language === "pl" ? 0 : 1];
  if (title)
    checks.title =
      typeof actual?.title === "string" &&
      (fold(actual.title) === fold(title) ||
        (id !== "023" && matchesCalendarText(title, actual.title)));
  if (deletionTitles[id])
    checks.target =
      typeof actual?.query === "string" &&
      fold(actual.query.replace(/^(?:event|wydarzenie)\s+/iu, "")) ===
        fold(deletionTitles[id]);
  if (expectedAction === "chat")
    checks.replyProduced =
      typeof actual?.reply === "string" && actual.reply.length > 0;
  if (expectedAction === "create" && id !== "020")
    checks.notInventedAllDay = actual?.allDay !== true;
  if (durationMinutes[id])
    checks.duration =
      typeof actual?.time === "string" &&
      /^\d{2}:\d{2}$/.test(actual.time) &&
      actual.endTime === timeString(minutes(actual.time) + durationMinutes[id]);
  for (const [key, value] of Object.entries(expectedFields[id] || {}))
    checks[key] =
      actual?.[key] === value ||
      (typeof value === "string" &&
        typeof actual?.query === "string" &&
        actual.query.includes(value));
  return checks;
}
export async function runAssistantBenchmark(options: {
  mode: BenchmarkMode;
  preset: "smoke" | "corpus" | "stability";
  signal: AbortSignal;
  resume?: BenchmarkRun;
  onProgress?: (run: BenchmarkRun) => void;
}) {
  const selected = modelStatus().modelId;
  if (options.resume && options.resume.modelId !== selected)
    throw new Error("benchmark-model-changed");
  const previousBuild = (
    options.resume?.conditions as { build?: { commit?: string } } | undefined
  )?.build?.commit;
  if (previousBuild && previousBuild !== diagnosticsReport().build.commit)
    throw new Error("benchmark-build-changed");
  const cases =
    options.preset === "smoke"
      ? BILINGUAL_CASES.filter((c) =>
          ["001", "009", "016", "036", "070"].includes(c.id),
        )
      : options.preset === "stability"
        ? Array.from({ length: 20 }, (_, i) => ({
            ...BILINGUAL_CASES[8],
            id: `stability-${i}`,
          }))
        : BILINGUAL_CASES;
  const queue = cases.flatMap((item) =>
    (["pl", "en"] as const).map((language) => ({ item, language })),
  );
  const now = new Date(BENCHMARK_REFERENCE),
    events = syntheticEvents();
  const run: BenchmarkRun = options.resume
    ? structuredClone(options.resume)
    : {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        modelId: selected,
        mode: options.mode,
        preset: options.preset,
        status: "running",
        nextIndex: 0,
        conditions: {
          reference: BENCHMARK_REFERENCE,
          build: diagnosticsReport().build,
          modelRevision: findModel(selected).revision,
          modelSha256: findModel(selected).sha256,
          engineVersion: appPackage.dependencies["@wllama/wllama"],
          publicSyntheticFixtures: true,
          calendarWrites: false,
          contextTokens: findModel(selected).maxContext,
          temperature: 0,
          topK: 50,
          repeatPenalty: 1.05,
          maxGenerationTokens:
            options.mode === "llm" ? 768 : "runtime defaults: 256/384/768",
          platform: Capacitor.getPlatform(),
          capabilities: diagnosticsReport().capabilities,
          note: "App PSS/CPU exclude the isolated WebView renderer. Missing metrics are null, not estimates.",
        },
        samples: [],
        results: [],
      };
  run.status = "running";
  await storeRun(run);
  options.onProgress?.(structuredClone(run));
  await unloadLocalModel();
  let sampling = false;
  let pressure = "";
  const memoryPressure = () => {
    pressure = "memory-pressure";
    cancelModelOperation();
  };
  window.addEventListener("calendar-memory-pressure", memoryPressure);
  const sample = async () => {
    if (sampling) return;
    sampling = true;
    try {
      const value = await deviceTelemetry();
      if (value.modelId !== selected) return;
      run.peaks ??= {};
      const native = value.native as Record<string, unknown> | undefined;
      if (
        native?.lowMemory === true ||
        (typeof native?.thermalStatus === "number" && native.thermalStatus >= 3)
      ) {
        pressure = native.lowMemory ? "memory-pressure" : "thermal-pressure";
        cancelModelOperation();
      }
      const values = {
        appPssKB: native?.appPssKB,
        jsHeapBytes: value.jsHeapBytes,
        ...(value.phase === "loading"
          ? { loadingAppPssKB: native?.appPssKB }
          : {}),
        ...(value.phase === "running"
          ? { generatingAppPssKB: native?.appPssKB }
          : {}),
        batteryTemperatureC: native?.batteryTemperatureC,
        thermalStatus: native?.thermalStatus,
      };
      for (const [key, number] of Object.entries(values))
        if (typeof number === "number" && Number.isFinite(number))
          run.peaks[key] = Math.max(run.peaks[key] ?? -Infinity, number);
      run.samples.push(value);
      if (run.samples.length > 3600) run.samples.splice(1, 1);
      if (run.samples.length % 10 === 0) await storeRun(run);
    } finally {
      sampling = false;
    }
  };
  await sample();
  const timer = setInterval(() => {
    void sample();
  }, 1000);
  const abort = () => cancelModelOperation();
  options.signal.addEventListener("abort", abort);
  let stabilityHistory: { role: "user" | "assistant"; content: string }[] = [];
  let stabilityConversation: ModelConversation = {};
  try {
    for (let i = run.nextIndex; i < queue.length; i++) {
      if (
        options.signal.aborted ||
        pressure ||
        modelStatus().modelId !== selected
      )
        break;
      const { item, language } = queue[i],
        query = item[language],
        started = performance.now();
      const previousMetric = modelMetrics().at(-1);
      let result: BenchmarkResult = {
        caseId: item.id,
        language,
        route: options.mode,
        elapsedMs: 0,
        checks: {},
        semanticReviewRequired:
          item.action === "chat" ||
          ["conversation", "availability", "search", "safety"].includes(
            item.category,
          ),
      };
      try {
        const context: ModelConversation =
          options.preset === 'stability' ? stabilityConversation : item.category === "context"
            ? {
                reference: { title: "Yoga", date: "2026-10-25" },
                turns: [
                  { role: "user", content: "Find event Yoga" },
                  {
                    role: "assistant",
                    content: '{"action":"search","query":"Yoga"}',
                  },
                ],
              }
            : {};
        let command: Record<string, unknown> | undefined;
        if (options.mode === "rules") {
          const quick = await assistantQuickReply(
            query,
            events,
            language,
            now,
            DEFAULT_PLANNING,
          );
          if (quick) {
            result.route = "quick";
            result.response = quick.text;
            result.checks = { responseProduced: true };
            result.semanticReviewRequired = true;
          } else {
            const parsed = parseCalendarCommand(
              query,
              language,
              now,
              context.pending,
            );
            command = parsed?.command as unknown as Record<string, unknown>;
            result.route = parsed ? "rules" : "unrouted";
            result.checks = scoreBenchmarkCommand(
              item.id,
              item.action,
              command,
              language,
            );
          }
        } else if (options.mode === "llm") {
          if (options.preset === "stability") {
            result.response = await inferLocalText(
              `Reply helpfully in ${language}. Do not claim any calendar changes.`,
              query,
              stabilityHistory,
              { maxTokens: 768, timeoutMs: 600000 },
            );
            result.checks = {
              responseProduced: result.response.length > 0,
              ...(item.id === "009" || options.preset === "stability"
                ? { arithmetic: /4|cztery|four/iu.test(result.response) }
                : {}),
            };
            if (options.preset === "stability")
              stabilityHistory = [
                ...stabilityHistory,
                { role: "user" as const, content: query },
                { role: "assistant" as const, content: result.response },
              ]
                .slice(-2)
                .map((t) => ({ ...t, content: t.content.slice(0, 600) }));
          } else {
            const raw = await inferCalendarJson(
              assistantSystemPrompt(language, now),
              query,
              ASSISTANT_SCHEMA,
              context.turns || [],
              { maxTokens: 768, timeoutMs: 600000 },
            );
            command = parseModelCommand(raw) as unknown as Record<
              string,
              unknown
            >;
            result.response = raw;
            result.checks = scoreBenchmarkCommand(
              item.id,
              item.action,
              command,
              language,
            );
            if (item.id === "009")
              result.checks.arithmetic = /4|cztery|four/iu.test(
                String(command.reply || ""),
              );
          }
          result.metric = modelMetrics().at(-1);
        } else {
          const response = await runModelAssistant(
            query,
            events,
            language === "pl" ? "en" : "pl",
            now,
            context,
            DEFAULT_PLANNING,
          );
          if (options.preset === 'stability') stabilityConversation = response.context || {};
          const plan = response.suggestedPlan,
            trace = assistantTurns().at(-1),
            event = plan?.events[0];
          command = plan
            ? {
                ...event,
                action:
                  plan.kind === "move"
                    ? "update"
                    : plan.kind === "delete"
                      ? "delete"
                      : "create",
                date: event?.startDate,
                time: event?.startTime,
                query: plan.originals[0]?.title,
              }
            : { action: trace?.commandAction, reply: response.text };
          result.route = response.route;
          result.response = response.text;
          result.checks = scoreBenchmarkCommand(
            item.id,
            item.action,
            command,
            language,
          );
          if (item.id === "009" || options.preset === "stability")
            result.checks.arithmetic = /4|cztery|four/iu.test(response.text);
          result.checks.languageRouting =
            response.language ===
            (item.id === "094" ? (language === "pl" ? "en" : "pl") : language);
          if (
            ["conversation", "availability", "search", "safety"].includes(
              item.category,
            )
          )
            result.checks.noCalendarMutationProposal = !plan;
          result.metric =
            response.route === "model" ? modelMetrics().at(-1) : undefined;
        }
      } catch (error) {
        result.error =
          error instanceof Error ? error.message : "benchmark-error";
        result.checks = { completed: false };
        const latest = modelMetrics().at(-1);
        if (latest !== previousMetric && latest?.route === "model")
          result.metric = latest;
      }
      result.elapsedMs = performance.now() - started;
      run.results.push(result);
      run.nextIndex = i + 1;
      await storeRun(run);
      options.onProgress?.(structuredClone(run));
      if (
        pressure ||
        options.signal.aborted ||
        document.hidden ||
        (result.error && (modelStatus().phase === "error" || ['model-inference','model-cancelled','model-busy'].includes(result.error)))
      )
        break;
    }
    run.status = run.nextIndex === queue.length ? "complete" : "stopped";
    if (run.status === "stopped")
      run.stopReason =
        pressure ||
        (options.signal.aborted
          ? "cancelled"
          : modelStatus().modelId !== selected
            ? "model-changed"
            : document.hidden
              ? "background"
              : "inference-error");
  } finally {
    clearInterval(timer);
    options.signal.removeEventListener("abort", abort);
    window.removeEventListener("calendar-memory-pressure", memoryPressure);
    await sample();
    await storeRun(run);
    options.onProgress?.(structuredClone(run));
  }
  return run;
}
export { summarizeBenchmarkRun } from "./benchmarkStats";
