import test from 'node:test';
import assert from 'node:assert/strict';
import { event } from './fixtures';
import { buildEventIndex, occurrenceInterval, occurrencesOverlap } from '../src/utils/recurrence';
import { timelineAxis, timelineOccurrence } from '../src/utils/timeline';
import { runLocalAiAssistant } from '../src/utils/aiEngine';
import { availableSlots, DEFAULT_PLANNING } from '../src/utils/assistantPlanning';

const date = '2026-10-25';
const zoned = (id: string, startTime: string, endTime: string) => event({
  id, title: id, startDate: date, endDate: date, startTime, endTime, timeZone: 'UTC',
});
async function warsaw(run: () => unknown) {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Warsaw';
  try { await run(); } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
}

test('fold keeps real endpoints and wall times separate from display coordinates', () => warsaw(() => {
  const original = zoned('fold', '00:30', '01:15');
  const o = buildEventIndex([original], date, date).get(date)![0];
  assert.deepEqual([o.startMinutes, o.endMinutes], [150, 135]);
  assert.deepEqual(occurrenceInterval(o), { start: Date.parse(`${date}T00:30:00Z`), end: Date.parse(`${date}T01:15:00Z`) });
  const displayed = timelineOccurrence(o, timelineAxis(date));
  assert.deepEqual([displayed.startMinutes, displayed.endMinutes], [150, 195]);
  assert.equal(displayed.source, o);
  assert.equal(o.event, original);
  assert.equal(original.endTime, '01:15');
}));

test('fold conflict detection distinguishes real overlap, touching ends and separate repeated hours', () => warsaw(async () => {
  const a = zoned('Fold meeting', '00:30', '01:15');
  const later = zoned('Later meeting', '02:00', '02:30');
  const overlapping = zoned('Real overlap', '01:00', '01:45');
  const touching = zoned('Touching end', '01:15', '01:30');
  const bucket = buildEventIndex([a, later, overlapping, touching], date, date).get(date)!;
  const byId = (id: string) => bucket.find(o => o.event.id === id)!;
  assert.equal(occurrencesOverlap(byId(a.id), byId(later.id)), false);
  assert.equal(occurrencesOverlap(byId(a.id), byId(touching.id)), false);
  assert.equal(occurrencesOverlap(byId(a.id), byId(overlapping.id)), true);
  const now = new Date(`${date}T00:00:00Z`);
  const clear = await runLocalAiAssistant('Check conflicts', [a, later], 'en', now);
  assert.match(clear.text, /No schedule conflicts/);
  const conflict = await runLocalAiAssistant('Check conflicts', [a, overlapping], 'en', now);
  assert.match(conflict.text, /Fold meeting/);
  assert.match(conflict.text, /Real overlap/);
  const first = zoned('First hour', '00:05', '00:25'), second = zoned('Second hour', '01:05', '01:25');
  assert.match((await runLocalAiAssistant('Check conflicts', [second, first], 'en', now)).text, /No schedule conflicts/);
  assert.deepEqual(buildEventIndex([second, first], date, date).get(date)!.map(o => o.event.id), [first.id, second.id]);
}));

test('rescheduling compares actual draft instants with existing zoned events', () => warsaw(async () => {
  const original = event({ id: 'target', title: 'Target', startDate: '2026-10-24', endDate: '2026-10-24', startTime: '03:00', endTime: '03:30' });
  const now = new Date('2026-10-24T06:00:00Z');
  const query = 'Move Target to tomorrow at 3am';
  const clear = await runLocalAiAssistant(query, [original, zoned('Fold meeting', '00:30', '01:15')], 'en', now);
  assert.equal(clear.suggestedPlan?.kind, 'move');
  assert.equal(clear.suggestedPlan?.events[0].startTime, '03:00');
  assert.doesNotMatch(clear.text, /Warning/);
  const conflict = await runLocalAiAssistant(query, [original, zoned('Overlap', '02:15', '02:45')], 'en', now);
  assert.match(conflict.text, /Warning/);
  assert.equal(original.startDate, '2026-10-24');
}));

test('availability does not extend a fold event into 03:00 and offers representable, collision-free drafts', () => warsaw(() => {
  const items = [zoned('Fold meeting', '00:30', '01:15')];
  const now = new Date('2026-10-24T06:00:00Z');
  const prefs = { ...DEFAULT_PLANNING, workingDays: [0], dayStart: '03:00', dayEnd: '04:00' };
  assert.deepEqual(availableSlots(items, date, date, 30, prefs, now), [{ date, start: 180, end: 240 }]);
  const slots = availableSlots(items, date, date, 30, { ...prefs, dayStart: '02:00' }, now);
  const existing = buildEventIndex(items, date, date).get(date)![0];
  for (const slot of slots) {
    const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const draft = event({ startDate: date, endDate: date, startTime: time(slot.start), endTime: time(slot.start + 30) });
    assert.equal(occurrencesOverlap(existing, buildEventIndex([draft], date, date).get(date)![0]), false);
  }
  assert.ok(slots.some(s => s.start === 180));
}));

test('real intervals retain recurring identity, midnight splitting and all-day bounds', () => warsaw(() => {
  const recurring = event({ ...zoned('Series', '00:30', '01:15'), startDate: '2026-10-18', endDate: '2026-10-18', recurrence: 'WEEKLY' });
  const o = buildEventIndex([recurring], date, date).get(date)![0];
  assert.equal(o.event, recurring);
  assert.equal(o.occurrenceDate, date);
  assert.equal(o.endInstant, Date.parse(`${date}T01:15:00Z`));
  const night = event({ startDate: date, endDate: '2026-10-26', startTime: '23:30', endTime: '00:30' });
  const index = buildEventIndex([night], date, '2026-10-26');
  const first = index.get(date)![0], second = index.get('2026-10-26')![0];
  assert.equal(first.endInstant, second.startInstant);
  assert.equal(occurrencesOverlap(first, second), false);
  const allDay = buildEventIndex([event({ allDay: true, startDate: '2026-10-26', endDate: '2026-10-26' })], '2026-10-26', '2026-10-26').get('2026-10-26')![0];
  assert.equal(occurrencesOverlap(first, allDay), false);
  assert.equal(occurrencesOverlap(second, allDay), true);
}));

test('half-hour DST ticks preserve complete HH:mm values', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Australia/Lord_Howe';
    const tick = timelineAxis('2026-10-04').ticks.find(t => t.label === '03:30')!;
    assert.equal(tick.time, '03:30');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
