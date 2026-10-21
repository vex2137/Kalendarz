import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalAiAssistant, parseDateFromNaturalLanguage, extractEventFromPromptOffline } from '../src/utils/aiEngine';
import { event } from './fixtures';
const now = new Date(2026, 9, 20, 10);

test('unknown and destructive commands never become new events', async () => {
  for (const query of ['Jaka jest pogoda?', 'To jest niezrozumiałe', 'Usuń dentystę jutro', 'Move dentist tomorrow']) {
    const result = await runLocalAiAssistant(query, [], 'pl', now);
    assert.equal(result.suggestedEvent, undefined, query);
  }
});
test('clarifications retain the draft until date and time are known', async () => {
  const first = await runLocalAiAssistant('Dodaj dentystę', [], 'pl', now);
  assert.equal(first.suggestedEvent, undefined);
  assert.ok(first.context?.pendingPrompt);
  const second = await runLocalAiAssistant('jutro', [], 'pl', now, first.context);
  assert.equal(second.suggestedEvent, undefined);
  const third = await runLocalAiAssistant('o 15', [], 'pl', now, second.context);
  assert.equal(third.suggestedEvent?.startDate, '2026-10-21');
  assert.equal(third.suggestedEvent?.startTime, '15:00');
  const fourth = await runLocalAiAssistant('jednak godzinę później', [], 'pl', now, third.context);
  assert.equal(fourth.suggestedEvent?.startTime, '16:00');
  assert.equal(fourth.suggestedEvent?.title, third.suggestedEvent?.title);
});
test('all-day clarification and English drafts work offline', async () => {
  const first = await runLocalAiAssistant('Add holiday tomorrow', [], 'en', now);
  const second = await runLocalAiAssistant('all day', [], 'en', now, first.context);
  assert.equal(second.suggestedEvent?.allDay, true);
  const draft = await runLocalAiAssistant('Add dentist tomorrow at 11pm', [], 'en', now);
  const shifted = await runLocalAiAssistant('actually one hour later', [], 'en', now, draft.context);
  assert.equal(shifted.suggestedEvent?.startDate, '2026-10-22');
  assert.equal(shifted.suggestedEvent?.startTime, '00:00');
});
test('relative weeks, last weekdays and month-end dates are parsed', () => {
  assert.equal(parseDateFromNaturalLanguage('za dwa tygodnie', now).dateStr, '2026-11-03');
  assert.equal(parseDateFromNaturalLanguage('in 2 weeks', now).dateStr, '2026-11-03');
  assert.equal(parseDateFromNaturalLanguage('ostatni piątek miesiąca', now).dateStr, '2026-10-30');
  assert.equal(parseDateFromNaturalLanguage('15 lutego', new Date(2026, 0, 31)).dateStr, '2026-02-15');
  assert.equal(parseDateFromNaturalLanguage('31.02.2026', now).matched, false);
});
test('ISO dates are not mistaken for time ranges and simple recurrence is retained', async () => {
  const result = await runLocalAiAssistant('Dodaj trening 2026-10-25 o 18 co tydzień', [], 'pl', now);
  assert.equal(result.suggestedEvent?.startTime, '18:00');
  assert.equal(result.suggestedEvent?.startDate, '2026-10-25');
  assert.equal(result.suggestedEvent?.recurrence, 'WEEKLY');
});
test('weekend and month summaries use the requested range', async () => {
  const events = [event({ id: 'a', title: 'Tuesday', startDate: '2026-10-20', endDate: '2026-10-20' }), event({ id: 'b', title: 'Saturday', startDate: '2026-10-24', endDate: '2026-10-24' }), event({ id: 'c', title: 'November', startDate: '2026-11-05', endDate: '2026-11-05' })];
  const weekend = await runLocalAiAssistant('Plan na weekend', events, 'pl', now);
  assert.match(weekend.text, /Saturday/);
  assert.doesNotMatch(weekend.text, /Tuesday|November/);
  const month = await runLocalAiAssistant('Summary of next month', events, 'en', now);
  assert.match(month.text, /November/);
  assert.doesNotMatch(month.text, /Tuesday|Saturday/);
});
test('free slots respect requested duration and time window', async () => {
  const events = [event({ startDate: '2026-10-20', endDate: '2026-10-20', startTime: '10:00', endTime: '16:30' })];
  const answer = await runLocalAiAssistant('Znajdź wolne 60 minut dzisiaj od 9 do 17', events, 'pl', new Date(2026, 9, 20, 8));
  assert.match(answer.text, /09:00.*10:00/);
  assert.doesNotMatch(answer.text, /16:30.*17:00/);
  const busy = await runLocalAiAssistant('Kiedy mam wolne dzisiaj?', [event({ startDate: '2026-10-20', endDate: '2026-10-20', allDay: true })], 'pl', now);
  assert.match(busy.text, /Brak okienek/);
});
test('existing overnight extraction remains supported', () => {
  const result = extractEventFromPromptOffline('Dodaj dyżur jutro o 23 na 2 godziny', now);
  assert.equal(result?.endDate, '2026-10-22');
  assert.equal(result?.endTime, '01:00');
});

test('a new creation command replaces pending clarification', async () => {
  const first = await runLocalAiAssistant('Dodaj dentystę', [], 'pl', now);
  const next = await runLocalAiAssistant('Dodaj kino jutro o 18', [], 'pl', now, first.context);
  assert.equal(next.suggestedEvent?.title, 'Kino');
});
test('draft corrections can change date and time together', async () => {
  const draft = await runLocalAiAssistant('Dodaj kino jutro o 18', [], 'pl', now);
  const corrected = await runLocalAiAssistant('jednak w piątek o 20', [], 'pl', now, draft.context);
  assert.equal(corrected.suggestedEvent?.startDate, '2026-10-23');
  assert.equal(corrected.suggestedEvent?.startTime, '20:00');
});
