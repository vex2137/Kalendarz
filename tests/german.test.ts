import test from 'node:test';
import assert from 'node:assert/strict';
import { getTranslation, MONTH_NAMES, DAY_NAMES_FULL, TRANSLATIONS, translateGerman, tr } from '../src/utils/i18n';
import { GERMAN_UI } from '../src/utils/german';
import { RUSSIAN_UI } from '../src/utils/russian';
import { locale } from '../src/utils/dates';
import { runLocalAiAssistant, parseDateFromNaturalLanguage } from '../src/utils/aiEngine';
import { loadStoredSettings, saveStoredSettings } from '../src/utils/settingsStorage';
import { event, memoryStorage } from './fixtures';
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage() });
const now = new Date(2026, 9, 21, 8);

test('German UI covers existing templates, localizes dates and persists; fresh installs remain English', () => {
  for (const key of Object.keys(RUSSIAN_UI)) assert.ok(GERMAN_UI[key], key);
  for (const key of Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[]) {
    assert.ok(TRANSLATIONS.de[key]);
    assert.notEqual(TRANSLATIONS.de[key], TRANSLATIONS.en[key], key);
  }
  assert.equal(getTranslation('de').appName, 'Kalender');
  assert.equal(MONTH_NAMES.de[2], 'März');
  assert.equal(DAY_NAMES_FULL.de[2], 'Mittwoch');
  assert.equal(locale('de'), 'de-DE');
  assert.equal(loadStoredSettings().language, 'en');
  saveStoredSettings({ ...loadStoredSettings(), language: 'de' });
  assert.equal(loadStoredSettings().language, 'de');
  assert.equal(tr('de', 'Kalendarz', 'Calendar'), 'Kalender');
});

test('German templates preserve inserted event titles, dates and punctuation', () => {
  assert.equal(translateGerman('Which date should I move “Meet [Alex] $5” to?'), 'Auf welches Datum soll ich „Meet [Alex] $5“ verschieben?');
  assert.match(translateGerman('I prepared 3 drafts of 60 minutes each. Review all dates before confirming.'), /3.*60/);
});

test('German creation, date/time clarification and draft correction work locally', async () => {
  const first = await runLocalAiAssistant('Füge Zahnarzt hinzu', [], 'de', now);
  assert.match(first.text, /welches Datum/);
  const second = await runLocalAiAssistant('morgen', [], 'de', now, first.context);
  assert.match(second.text, /wie viel Uhr/);
  const draft = await runLocalAiAssistant('um 15 Uhr für 30 Minuten', [], 'de', now, second.context);
  assert.equal(draft.suggestedEvent?.title, 'Zahnarzt');
  assert.equal(draft.suggestedEvent?.startDate, '2026-10-22');
  assert.equal(draft.suggestedEvent?.endTime, '15:30');
  assert.match(draft.text, /vorgeschlagene/);
  const corrected = await runLocalAiAssistant('doch eine Stunde später', [], 'de', now, draft.context);
  assert.equal(corrected.suggestedEvent?.startTime, '16:00');
});

test('German search, agenda, moving, availability and batch proposals preserve saved events', async () => {
  const original = event({ title: 'Zahnarzt mit Anna', startDate: '2026-10-21', endDate: '2026-10-21' });
  const found = await runLocalAiAssistant('Suche Zahnarzt', [original], 'de', now);
  assert.match(found.text, /Passende Termine/);
  assert.match(found.text, /Zahnarzt mit Anna/);
  const agenda = await runLocalAiAssistant('Was habe ich heute?', [original], 'de', now);
  assert.match(agenda.text, /Dein Terminplan/);
  const moved = await runLocalAiAssistant('Verschiebe Zahnarzt auf Freitag um 16 Uhr', [original], 'de', now);
  assert.equal(moved.suggestedPlan?.kind, 'move');
  assert.equal(moved.suggestedPlan?.events[0].id, original.id);
  assert.equal(moved.suggestedPlan?.events[0].startDate, '2026-10-23');
  assert.equal(moved.suggestedPlan?.events[0].startTime, '16:00');
  assert.equal(parseDateFromNaturalLanguage('in zwei Wochen', now, 'de').dateStr, '2026-11-04');
  assert.equal(parseDateFromNaturalLanguage('am 23. Oktober', now, 'de').dateStr, '2026-10-23');
  const free = await runLocalAiAssistant('Wann habe ich morgen frei für 60 Minuten?', [], 'de', now);
  assert.match(free.text, /Freie Zeitfenster/);
  const batch = await runLocalAiAssistant('Plane drei einstündige Trainings nächste Woche', [], 'de', now);
  assert.equal(batch.suggestedPlan?.events.length, 3);
  assert.match(batch.text, /3.*60/);
  const conflicts = await runLocalAiAssistant('Prüfe Überschneidungen', [], 'de', now);
  assert.match(conflicts.text, /Keine Überschneidungen/);
  assert.equal(original.startDate, '2026-10-21');
});
