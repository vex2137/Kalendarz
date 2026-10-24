import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppLanguage } from '../utils/i18n';
import { diagnosticsReport, modelMetrics, assistantTurns, nativeBuildInfo, recordNativeBuild, subscribeMetrics } from '../utils/modelDiagnostics';
import { inferCalendarJson, modelStatus, subscribeModel, unloadLocalModel } from '../utils/localModelRuntime';
import { calendarSystemPrompt, COMMAND_SCHEMA } from '../utils/modelCommand';
import { CalendarDevice } from '../utils/nativeDevice';
import { Capacitor } from '@capacitor/core';
import { BUILD_INFO } from '../utils/buildInfo';
import { ModelBenchmarks } from './ModelBenchmarks';

const copy = {
  en: ['AI diagnostics', 'Device test: cold + warm', 'Export JSON', 'Release memory', 'Runs the real model twice without saving events. Use airplane mode to verify offline operation.', 'Test failed. Export diagnostics and retry.'],
  pl: ['Diagnostyka AI', 'Test telefonu: zimny + ciepły', 'Eksportuj JSON', 'Zwolnij pamięć', 'Uruchamia prawdziwy model dwa razy bez zapisu wydarzeń. Włącz tryb samolotowy, aby sprawdzić działanie offline.', 'Test nie powiódł się. Wyeksportuj diagnostykę i spróbuj ponownie.'],
  ru: ['Диагностика ИИ', 'Тест: холодный + прогретый', 'Экспорт JSON', 'Освободить память', 'Два запуска настоящей модели без сохранения событий. Включите авиарежим для проверки офлайн.', 'Тест не пройден. Экспортируйте диагностику и повторите.'],
  de: ['KI-Diagnose', 'Gerätetest: kalt + warm', 'JSON exportieren', 'Speicher freigeben', 'Zwei echte Modellaufrufe ohne Termine zu speichern. Offline im Flugmodus prüfen.', 'Test fehlgeschlagen. Diagnose exportieren und erneut versuchen.'],
};
export function ModelDiagnostics({ language, enabled }: { language: AppLanguage; enabled: boolean }) {
  const metrics = useSyncExternalStore(subscribeMetrics, modelMetrics);
  const turns = useSyncExternalStore(subscribeMetrics, assistantTurns);
  useSyncExternalStore(subscribeMetrics, nativeBuildInfo);
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(false);
  const [singleThread, setSingleThread] = useState(false);
  const text = copy[language];
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') void CalendarDevice.diagnosticsBuildInfo().then(recordNativeBuild).catch(() => {});
  }, []);
  const busy = testing || ['loading', 'running', 'downloading', 'verifying', 'checking'].includes(status.phase);
  const test = async () => {
    setTesting(true); setError(false);
    try {
      await unloadLocalModel();
      const system = calendarSystemPrompt(language, new Date());
      const query = language === 'pl' ? 'Dodaj wydarzenie Pomiar jutro o 14:15' : 'Add event Measurement tomorrow at 14:15';
      await inferCalendarJson(system, `Current request:\n${query}`, COMMAND_SCHEMA, [], { threads: singleThread ? 1 : undefined });
      await inferCalendarJson(system, `Current request:\n${query}`, COMMAND_SCHEMA, [], { threads: singleThread ? 1 : undefined });
    } catch { setError(true); } finally { setTesting(false); }
  };
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(diagnosticsReport(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'calendar-ai-diagnostics.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section data-testid="model-diagnostics" className="p-3 text-xs theme-text">
    <h4 className="font-semibold">{text[0]}</h4>
    <p className="mt-2 break-all" data-build-commit={BUILD_INFO.commit}>Commit: {BUILD_INFO.commit}{BUILD_INFO.dirty ? ' (modified)' : ''}</p>
    <p data-assistant-route={turns.at(-1)?.route || 'none'}>{({ en: 'Last message path', pl: 'Ścieżka ostatniej wiadomości', ru: 'Путь последнего сообщения', de: 'Pfad der letzten Nachricht' })[language]}: {turns.at(-1)?.route || '—'} {turns.at(-1) ? `(${turns.at(-1)!.language}, ${Math.round(turns.at(-1)!.totalMs)} ms)` : ''}</p>
    <p className="my-2">{text[4]}</p>
    <label className="flex gap-2 mb-2"><input type="checkbox" checked={singleThread} disabled={busy} onChange={e => setSingleThread(e.target.checked)} />{({ en: 'Compare with one CPU thread', pl: 'Porównaj z jednym wątkiem CPU', ru: 'Сравнить с одним потоком CPU', de: 'Mit einem CPU-Thread vergleichen' })[language]}</label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !enabled || !status.installed} onClick={() => { void test(); }} className="theme-border border rounded p-2 disabled:opacity-50">{text[1]}</button>
      <button type="button" onClick={exportJson} className="theme-border border rounded p-2">{text[2]}</button>
      <button type="button" disabled={busy} onClick={() => { void unloadLocalModel(); }} className="theme-border border rounded p-2 disabled:opacity-50">{text[3]}</button>
    </div>
    {error && <p role="alert">{text[5]}</p>}
    <pre id="ai-diagnostics-report" className="overflow-auto max-h-48 mt-2" aria-live="polite">{JSON.stringify({ ...diagnosticsReport(), metrics: undefined, turns: undefined, lastTurn: turns.at(-1), lastModel: metrics.at(-1) }, null, 2)}</pre>
    <ModelBenchmarks language={language} disabled={busy || !enabled || !status.installed}/>
  </section>;
}
