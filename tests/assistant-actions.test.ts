import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalAiAssistant } from '../src/utils/aiEngine';
import { availableSlots, DEFAULT_PLANNING, planningPreferences, searchCalendar } from '../src/utils/assistantPlanning';
import { applyAssistantChanges, commitCalendar, loadCalendar } from '../src/utils/calendarStore';
import { changesForPlan } from '../src/utils/assistantChanges';
import { loadStoredSettings, saveStoredSettings } from '../src/utils/settingsStorage';
import { getTranslation } from '../src/utils/i18n';
import { event, memoryStorage } from './fixtures';
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage() });
localStorage.setItem('offline_calendar_events_v2', '[]');
const now = new Date(2026, 9, 20, 8);

test('search matches Polish inflections, English plurals and person names', () => {
  const events = [event({ title: 'Dentysta' }), event({ id: 'adam', title: 'Spotkanie z Adamem' }), event({ id: 'en', title: 'Team meetings' })];
  assert.equal(searchCalendar(events, 'dentystę')[0].title, 'Dentysta');
  assert.equal(searchCalendar(events, 'dentists')[0].title, 'Dentysta');
  assert.equal(searchCalendar(events, 'spotkania z Adamem')[0].id, 'adam');
  assert.equal(searchCalendar(events, 'meeting with Adam')[0].id, 'adam');
  assert.equal(searchCalendar(events, 'team meeting')[0].id, 'en');
});
test('reschedule works in Polish and English without modifying the original', async () => {
  for (const [lang, query] of [['pl', 'Przełóż dentystę na piątek o 16'], ['en', 'Move dentist to Friday at 4pm']] as const) {
    const original = event({ title: 'Dentysta', location: 'Clinic', reminders: [30] });
    const result = await runLocalAiAssistant(query, [original], lang, now);
    assert.equal(result.suggestedPlan?.kind, 'move');
    assert.equal(result.suggestedPlan?.events[0].startDate, '2026-10-23');
    assert.equal(result.suggestedPlan?.events[0].startTime, '16:00');
    assert.equal(result.suggestedPlan?.events[0].endTime, '17:00');
    assert.deepEqual(result.suggestedPlan?.events[0].reminders, [30]);
    assert.equal(original.startDate, '2026-10-19');
  }
});
test('ambiguous reschedule asks for a choice and then uses its requested date', async () => {
  const events = [event({ title: 'Dentist' }), event({ id: 'other', title: 'Dentist', startTime: '12:00', endTime: '13:00' })];
  const first = await runLocalAiAssistant('Move dentist to Friday at 4pm', events, 'en', now);
  assert.equal(first.suggestedPlan, undefined);
  assert.equal(first.context?.moveChoices?.length, 2);
  const second = await runLocalAiAssistant('2', events, 'en', now, first.context);
  assert.equal(second.suggestedPlan?.originals[0].id, 'other');
});
test('reschedule asks for a missing date and protects recurring series', async () => {
  const original = event({ title: 'Dentist' });
  const first = await runLocalAiAssistant('Move dentist', [original], 'en', now);
  assert.ok(first.context?.movingEvent);
  const second = await runLocalAiAssistant('tomorrow at 3pm', [original], 'en', now, first.context);
  assert.equal(second.suggestedPlan?.events[0].startTime, '15:00');
  const recurring = await runLocalAiAssistant('Move dentist to Friday', [{ ...original, recurrence: 'WEEKLY' }], 'en', now);
  assert.equal(recurring.suggestedPlan, undefined);
  assert.match(recurring.text, /series/);
});
test('batch planning produces three distinct conflict-free days in both languages', async () => {
  for (const [lang, query] of [['pl', 'Zaplanuj trzy godzinne treningi w przyszłym tygodniu'], ['en', 'Schedule three one-hour workouts next week']] as const) {
    const result = await runLocalAiAssistant(query, [], lang, now);
    assert.equal(result.suggestedPlan?.events.length, 3, result.text);
    assert.equal(new Set(result.suggestedPlan!.events.map(e => e.startDate)).size, 3);
    assert.equal(result.suggestedPlan!.events[0].startDate, '2026-10-26');
    assert.equal(result.suggestedPlan!.events[0].startTime, '08:00');
    assert.equal(result.suggestedPlan!.events[0].endTime, '09:00');
  }
});
test('planning honors buffers, preferred days, recurring busy times and insufficient space', async () => {
  const prefs = { ...DEFAULT_PLANNING, dayStart: '09:00', dayEnd: '12:00', workingDays: [2], bufferMinutes: 15 };
  const busy = event({ startDate: '2026-10-20', endDate: '2026-10-20', startTime: '10:00', endTime: '11:00', recurrence: 'WEEKLY' });
  const slots = availableSlots([busy], '2026-10-20', '2026-10-27', 30, prefs, now);
  assert.deepEqual(slots.map(s => [s.date, s.start, s.end]), [['2026-10-20', 540, 585], ['2026-10-20', 675, 720], ['2026-10-27', 540, 585], ['2026-10-27', 675, 720]]);
  const batch = await runLocalAiAssistant('Schedule three one-hour workouts next week', [], 'en', now, {}, prefs);
  assert.equal(batch.suggestedPlan, undefined);
});
test('conflict detection proposes a free replacement with a preview', async () => {
  const events = [event({ id: 'a', title: 'A', startDate: '2026-10-20', endDate: '2026-10-20' }), event({ id: 'b', title: 'B', startDate: '2026-10-20', endDate: '2026-10-20' })];
  for (const lang of ['pl', 'en'] as const) {
    const result = await runLocalAiAssistant(lang === 'pl' ? 'Sprawdź kolizje' : 'Check conflicts', events, lang, now);
    assert.equal(result.suggestedPlan?.kind, 'move');
    assert.ok(result.suggestedPlan!.events[0].startTime! >= '10:00' || result.suggestedPlan!.events[0].endTime! <= '09:00');
  }
});
test('English is default, explicit Polish is retained and planning preferences survive reload', () => {
  localStorage.removeItem('offline_calendar_settings_v2');
  assert.equal(loadStoredSettings().language, 'en');
  assert.equal(getTranslation('en').appName, 'Calendar');
  assert.equal(getTranslation('pl').appName, 'Kalendarz');
  const settings = { ...loadStoredSettings(), language: 'pl' as const, ai: { ...loadStoredSettings().ai, planning: { ...DEFAULT_PLANNING, bufferMinutes: 20 } } };
  saveStoredSettings(settings);
  assert.equal(loadStoredSettings().language, 'pl');
  assert.equal(loadStoredSettings().ai.planning?.bufferMinutes, 20);
  assert.equal(planningPreferences({ workingDays: [] }).workingDays.length, 0);
});
test('batch save and undo are atomic; undo preserves unrelated edits', async () => {
  const result = await runLocalAiAssistant('Schedule three one-hour workouts next week', [], 'en', now);
  const changes = changesForPlan(result.suggestedPlan!);
  const inverse = await applyAssistantChanges(changes);
  assert.equal((await loadCalendar()).events.length, 3);
  await commitCalendar([event({ id: 'unrelated' })]);
  await applyAssistantChanges(inverse);
  assert.deepEqual((await loadCalendar()).events.map(e => e.id), ['unrelated']);
});
test('stale move previews and stale undo never overwrite subsequent changes', async () => {
  const original = event({ id: 'stale', title: 'Dentist' });
  await commitCalendar([original]);
  const result = await runLocalAiAssistant('Move dentist to Friday at 4pm', [original], 'en', now);
  const inverse = await applyAssistantChanges(changesForPlan(result.suggestedPlan!));
  const applied = (await loadCalendar()).events.find(e => e.id === 'stale')!;
  await commitCalendar([{ ...applied, title: 'Manually edited', updatedAt: applied.updatedAt + 1 }]);
  await assert.rejects(applyAssistantChanges(inverse), /changed/);
  await assert.rejects(applyAssistantChanges(changesForPlan(result.suggestedPlan!)), /changed/);
  assert.equal((await loadCalendar()).events.find(e => e.id === 'stale')?.title, 'Manually edited');
});
test('one stale target prevents the entire assistant batch from being written', async () => {
  const original = event({ id: 'atomic' });
  await commitCalendar([original]);
  const addition = event({ id: 'must-not-exist' });
  await assert.rejects(applyAssistantChanges([{ after: addition }, { before: { ...original, title: 'Stale' }, after: { ...original, startTime: '08:00' } }]), /changed/);
  assert.equal((await loadCalendar()).events.some(e => e.id === 'must-not-exist'), false);
});

test('numeric counts and hyphenated English durations are not confused', async () => {
  for (const [lang, query, end] of [['pl', 'Zaplanuj 3 godzinne treningi w przyszłym tygodniu', '09:00'], ['en', 'Schedule 3 30-minute workouts next week', '08:30']] as const) {
    const result = await runLocalAiAssistant(query, [], lang, now);
    assert.equal(result.suggestedPlan?.events.length, 3, result.text);
    assert.equal(result.suggestedPlan?.events[0].endTime, end);
  }
});
test('natural English agenda and relative dates work like their Polish counterparts', async () => {
  const events = [event({ title: 'Tomorrow meeting', startDate: '2026-10-21', endDate: '2026-10-21' })];
  const result = await runLocalAiAssistant('What do I have tomorrow?', events, 'en', now);
  assert.match(result.text, /Tomorrow meeting/);
  const create = await runLocalAiAssistant('Add dentist in two days at 3pm', [], 'en', now);
  assert.equal(create.suggestedEvent?.startDate, '2026-10-22');
});
