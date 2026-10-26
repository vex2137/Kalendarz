import test from 'node:test';
import assert from 'node:assert/strict';
import { event } from './fixtures';
import { monthDates, monthWeekSegments, weekDates, agendaRows } from '../src/utils/calendarLayout';
import { buildEventIndex } from '../src/utils/recurrence';
import { layoutOverlaps } from '../src/utils/layout';
import { addDays } from '../src/utils/dates';

test('month grids have exactly four, five or six full weeks, including configured week start', () => {
  assert.equal(monthDates(new Date(2027, 1, 15)).length, 28);
  assert.equal(monthDates(new Date(2027, 3, 15)).length, 35);
  assert.equal(monthDates(new Date(2027, 4, 15)).length, 42);
  const sunday = monthDates(new Date(2027, 1, 15), 0);
  assert.equal(sunday.length, 35);
  assert.equal(sunday[0], '2027-01-31');
  assert.equal(monthDates(new Date(2024, 1, 1)).filter(d => d.startsWith('2024-02')).length, 29);
});

test('weeks cross month/year and both DST boundaries using floating dates', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(weekDates('2027-02-01')[0], '2027-02-01');
  assert.equal(weekDates('2024-02-29')[3], '2024-02-29');
  for (const start of ['2026-03-27', '2026-10-23']) {
    const days = weekDates(start);
    for (let i = 1; i < days.length; i++) assert.equal(days[i], addDays(days[i - 1], 1));
  }
});

test('multi-day bars cover their dates and continue across week, month and year with original identity', () => {
  const original = event({ allDay: true, startDate: '2026-12-31', endDate: '2027-01-05', color: 'banana' });
  const events = [original];
  const index = buildEventIndex(events, '2026-12-27', '2027-01-11');
  const first = monthWeekSegments(weekDates('2027-01-01'), index);
  const second = monthWeekSegments(weekDates('2027-01-05'), index);
  assert.deepEqual([first[0].start, first[0].end, first[0].continuesBefore, first[0].continuesAfter], [3, 6, false, true]);
  assert.deepEqual([second[0].start, second[0].end, second[0].continuesBefore, second[0].continuesAfter], [0, 1, true, false]);
  assert.equal(first[0].occurrence.event, original);
  assert.equal(second[0].occurrence.event, original);
  assert.equal(second[0].occurrence.event.color, 'banana');
  assert.equal(events.length, 1);
});

test('recurrences spanning dates remain separate occurrences and bars never share occupied lanes', () => {
  const items = [event({ id: 'repeat', allDay: true, startDate: '2027-02-01', endDate: '2027-02-03', recurrence: 'DAILY' }),
    event({ id: 'overlap', allDay: true, startDate: '2027-02-02', endDate: '2027-02-06' })];
  const index = buildEventIndex(items, '2027-01-31', '2027-02-08');
  const segments = monthWeekSegments(weekDates('2027-02-01'), index);
  assert.equal(new Set(segments.filter(s => s.occurrence.event.id === 'repeat').map(s => s.occurrence.occurrenceDate)).size, 7);
  for (let day = 0; day < 7; day++) {
    const occupied = segments.filter(s => s.start <= day && s.end >= day);
    assert.equal(new Set(occupied.map(s => s.lane)).size, occupied.length);
  }
  assert.deepEqual(monthWeekSegments(weekDates('2027-02-01'), index), segments);
});

test('midnight end is exclusive for timed bars, all-day inclusive end is preserved', () => {
  const midnight = event({ startDate: '2027-02-01', endDate: '2027-02-03', startTime: '23:00', endTime: '00:00' });
  const index = buildEventIndex([midnight], '2027-01-31', '2027-02-08');
  const segment = monthWeekSegments(weekDates('2027-02-01'), index)[0];
  assert.equal(segment.end, 1);
  assert.equal(index.has('2027-02-03'), false);
  const allDay = buildEventIndex([event({ ...midnight, allDay: true })], '2027-02-01', '2027-02-03');
  assert.equal(allDay.has('2027-02-03'), true);
});

test('very short visual blocks receive separate columns without changing actual times', () => {
  const items = [event({ id: 'a', endTime: '09:05' }), event({ id: 'b', startTime: '09:05', endTime: '09:10' })];
  const positioned = layoutOverlaps(buildEventIndex(items, '2026-10-19', '2026-10-19').get('2026-10-19')!, 18);
  assert.equal(positioned[0].columns, 2);
  assert.notEqual(positioned[0].column, positioned[1].column);
  assert.equal(positioned[0].endMinutes, 545);
});

test('agenda groups and sorts all-day, timed and multi-day events without cloning stored events', () => {
  const original = event({ id: 'span', allDay: true, startDate: '2026-12-31', endDate: '2027-01-02' });
  const items = [event({ id: 'late', startDate: '2027-01-01', endDate: '2027-01-01', startTime: '15:00', endTime: '16:00' }), original,
    event({ id: 'early', startDate: '2027-01-01', endDate: '2027-01-01' })];
  const rows = agendaRows(buildEventIndex(items, '2026-12-31', '2027-01-02'));
  assert.deepEqual(rows.filter(r => !r.occurrence).map(r => r.date), ['2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(rows.filter(r => r.date === '2027-01-01' && r.occurrence).map(r => r.occurrence!.event.id), ['span', 'early', 'late']);
  for (const row of rows.filter(r => r.occurrence?.event.id === 'span')) assert.equal(row.occurrence!.event, original);
  assert.equal(items.length, 3);
});

test('changing system timezone invalidates cached display occurrences', () => {
  const previous = process.env.TZ;
  try {
    const items = [event({ startTime: '23:00', endTime: '23:30', timeZone: 'America/New_York' })];
    process.env.TZ = 'Europe/Warsaw';
    assert.equal(buildEventIndex(items, '2026-10-19', '2026-10-20').get('2026-10-20')![0].startMinutes, 300);
    process.env.TZ = 'America/New_York';
    assert.equal(buildEventIndex(items, '2026-10-19', '2026-10-20').get('2026-10-19')![0].startMinutes, 1380);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('day geometry uses local wall-clock hours across spring and autumn clock changes', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Warsaw';
    const spring = event({ startDate: '2026-03-29', endDate: '2026-03-29', startTime: '00:30', endTime: '01:30', timeZone: 'UTC' });
    const fall = event({ startDate: '2026-10-25', endDate: '2026-10-25', startTime: '00:30', endTime: '02:30', timeZone: 'UTC' });
    const s = buildEventIndex([spring], spring.startDate, spring.endDate).get(spring.startDate)![0];
    const f = buildEventIndex([fall], fall.startDate, fall.endDate).get(fall.startDate)![0];
    assert.deepEqual([s.startMinutes, s.endMinutes], [90, 210]);
    assert.deepEqual([f.startMinutes, f.endMinutes], [150, 210]);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('DST timeline preserves elapsed duration, repeated-hour events and non-overlapping instants', async () => {
  const { timelineAxis, timelineOccurrence } = await import('../src/utils/timeline');
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Warsaw';
    const spring = timelineAxis('2026-03-29'), fall = timelineAxis('2026-10-25');
    assert.equal(spring.minutes, 1380);
    assert.equal(fall.minutes, 1500);
    assert.equal(spring.ticks.some(t => t.hour === 2), false);
    assert.deepEqual(fall.ticks.filter(t => t.hour === 2).map(t => t.label), ['02:00 UTC+2', '02:00 UTC+1']);
    const items = [event({ startDate: '2026-10-25', endDate: '2026-10-25', startTime: '00:30', endTime: '01:15', timeZone: 'UTC' }),
      event({ id: 'second-hour', startDate: '2026-10-25', endDate: '2026-10-25', startTime: '01:30', endTime: '02:00', timeZone: 'UTC' })];
    const occurrences = buildEventIndex(items, '2026-10-25', '2026-10-25').get('2026-10-25')!;
    assert.equal(occurrences.length, 2, 'a backwards wall-clock interval must not disappear');
    const positioned = layoutOverlaps(occurrences.map(o => timelineOccurrence(o, fall)));
    assert.deepEqual(positioned.map(o => [o.startMinutes, o.endMinutes, o.columns]), [[150, 195, 1], [210, 240, 1]]);
    const s = event({ startDate: '2026-03-29', endDate: '2026-03-29', startTime: '00:30', endTime: '01:30', timeZone: 'UTC' });
    const displayed = timelineOccurrence(buildEventIndex([s], s.startDate, s.endDate).get(s.startDate)![0], spring);
    assert.equal(displayed.endMinutes - displayed.startMinutes, 60);
    process.env.TZ = 'Australia/Lord_Howe';
    assert.equal(timelineAxis('2026-10-04').minutes, 1410);
    assert.equal(timelineAxis('2026-04-05').minutes, 1470);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
