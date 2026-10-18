import test from 'node:test';
import assert from 'node:assert/strict';
import { event } from './fixtures';
import { addDays, localDate, shiftMonth } from '../src/utils/dates';
import {
  buildEventIndex,
  isEventOccurringOnDate,
} from '../src/utils/recurrence';
import { validateEvent } from '../src/utils/validation';
import { serializeICS, parseICSToEvents } from '../src/utils/storage';
import { layoutOverlaps } from '../src/utils/layout';
import { dueReminders } from '../src/utils/notifications';
import {
  runLocalAiAssistant,
  extractEventFromPromptOffline,
} from '../src/utils/aiEngine';
import { getPolishHolidays } from '../src/utils/holidays';
import { zonedDateTime } from '../src/utils/timezone';

test('local dates and DST arithmetic never use the UTC day as the calendar day', () => {
  assert.equal(localDate(new Date(2026, 9, 18, 0, 15)), '2026-10-18');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
});
test('month/year navigation clamps at month end', () => {
  assert.equal(localDate(shiftMonth(new Date(2026, 0, 31), 1)), '2026-02-28');
  assert.equal(localDate(shiftMonth(new Date(2024, 1, 29), 12)), '2025-02-28');
});
test('weekly COUNT counts individual weekdays, including a partial first week', () => {
  const e = event({
    recurrence: 'CUSTOM',
    customRecurrence: {
      unit: 'WEEK',
      interval: 1,
      daysOfWeek: [1, 3],
      endType: 'COUNT',
      count: 1,
    },
  });
  assert.equal(isEventOccurringOnDate(e, '2026-10-19'), true);
  assert.equal(isEventOccurringOnDate(e, '2026-10-21'), false);
  const late = event({
    startDate: '2026-10-21',
    endDate: '2026-10-21',
    recurrence: 'CUSTOM',
    customRecurrence: {
      unit: 'WEEK',
      interval: 2,
      daysOfWeek: [1, 3],
      endType: 'COUNT',
      count: 2,
    },
  });
  assert.equal(isEventOccurringOnDate(late, '2026-10-21'), true);
  assert.equal(isEventOccurringOnDate(late, '2026-11-02'), true);
  assert.equal(isEventOccurringOnDate(late, '2026-11-04'), false);
});
test('monthly/yearly counts skip nonexistent days rather than consuming occurrences', () => {
  const monthly = event({
    startDate: '2026-01-31',
    endDate: '2026-01-31',
    recurrence: 'CUSTOM',
    customRecurrence: {
      unit: 'MONTH',
      interval: 1,
      endType: 'COUNT',
      count: 2,
    },
  });
  assert.equal(isEventOccurringOnDate(monthly, '2026-03-31'), true);
  assert.equal(isEventOccurringOnDate(monthly, '2026-05-31'), false);
  const yearly = event({
    startDate: '2024-02-29',
    endDate: '2024-02-29',
    recurrence: 'CUSTOM',
    customRecurrence: { unit: 'YEAR', interval: 1, endType: 'COUNT', count: 2 },
  });
  assert.equal(isEventOccurringOnDate(yearly, '2028-02-29'), true);
  assert.equal(isEventOccurringOnDate(yearly, '2032-02-29'), false);
});
test('until dates and exclusions are honored', () => {
  const e = event({
    recurrence: 'CUSTOM',
    customRecurrence: {
      unit: 'DAY',
      interval: 1,
      endType: 'UNTIL_DATE',
      untilDate: '2026-10-21',
    },
    exdates: ['2026-10-20'],
  });
  assert.deepEqual(
    [...buildEventIndex([e], '2026-10-19', '2026-10-23').keys()],
    ['2026-10-19', '2026-10-21'],
  );
});
test('multi-day recurring events are split across midnight, ending at midnight is exclusive', () => {
  const e = event({
    startTime: '23:00',
    endDate: '2026-10-20',
    endTime: '01:00',
    recurrence: 'WEEKLY',
  });
  const index = buildEventIndex([e], '2026-10-26', '2026-10-27');
  assert.equal(index.get('2026-10-26')![0].startMinutes, 1380);
  assert.equal(index.get('2026-10-27')![0].endMinutes, 60);
  assert.equal(
    buildEventIndex(
      [event({ endDate: '2026-10-20', endTime: '00:00' })],
      '2026-10-20',
      '2026-10-20',
    ).size,
    0,
  );
});
test('overlap columns separate nested and adjacent meetings', () => {
  const events = [
    event({ id: 'a', endTime: '13:00' }),
    event({ id: 'b', startTime: '10:00', endTime: '11:00' }),
    event({ id: 'c', startTime: '12:00', endTime: '12:30' }),
  ];
  const items = layoutOverlaps(
    buildEventIndex(events, '2026-10-19', '2026-10-19').get('2026-10-19')!,
  );
  assert.equal(items[0].columns, 2);
  assert.notEqual(items[0].column, items[2].column);
});
test('invalid dates, durations, colors, reminders and recurrences are rejected', () => {
  for (const patch of [
    { startDate: '2026-02-30' },
    { endTime: '08:00' },
    { color: 'unknown' },
    { reminders: [-1] },
    { recurrence: 'CUSTOM', customRecurrence: { interval: 0 } },
  ])
    assert.throws(() => validateEvent(event(patch as any)));
});
test('ICS round trip preserves UID, escaping, rules, alarms, colors and inclusive all-day end', () => {
  const original = [
    event({
      title: 'Spotkanie, kawa; plan\\test\nNowy wiersz',
      description: 'Opis; szczegóły, tak',
      recurrence: 'WEEKLY',
      reminders: [0, 15],
      color: 'lavender',
    }),
    event({
      id: 'all-day',
      startTime: undefined,
      endTime: undefined,
      allDay: true,
      endDate: '2026-10-21',
    }),
  ];
  const text = serializeICS(original);
  assert.match(text, /DTEND;VALUE=DATE:20261022/);
  const restored = parseICSToEvents(text);
  assert.equal(restored[0].id, original[0].id);
  assert.equal(restored[0].title, original[0].title);
  assert.deepEqual(restored[0].reminders, [0, 15]);
  assert.equal(restored[0].color, 'lavender');
  assert.equal(isEventOccurringOnDate(restored[0], '2026-10-26'), true);
  assert.equal(restored[1].endDate, '2026-10-21');
  assert.equal(parseICSToEvents(text)[0].id, restored[0].id);
});
test('ICS TZID, EXDATE, folded lines and detached exceptions are preserved', () => {
  const text =
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:external\r\nSUMMARY:Long\r\n  title\r\nDTSTART;TZID=Europe/Warsaw:20261019T090000\r\nDTEND;TZID=Europe/Warsaw:20261019T100000\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE;TZID=Europe/Warsaw:20261026T090000\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [e] = parseICSToEvents(text);
  assert.equal(e.timeZone, 'Europe/Warsaw');
  assert.equal(e.title, 'Long title');
  assert.equal(isEventOccurringOnDate(e, '2026-10-26'), false);
  assert.equal(isEventOccurringOnDate(e, '2026-11-02'), true);
});
test('malformed ICS never silently becomes a valid appointment', () => {
  assert.throws(() =>
    parseICSToEvents(
      'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:broken\nEND:VEVENT\nEND:VCALENDAR',
    ),
  );
});
test('recurring and previous-day reminders include zero-minute alarms and catch-up', () => {
  const from = new Date('2026-10-26T08:59:00+01:00').getTime(),
    to = new Date('2026-10-26T09:01:00+01:00').getTime();
  const due = dueReminders(
    [
      event({ id: 'weekly', recurrence: 'WEEKLY', reminders: [0] }),
      event({
        id: 'tomorrow',
        startDate: '2026-10-27',
        endDate: '2026-10-27',
        reminders: [1440],
      }),
    ],
    from,
    to,
  );
  assert.deepEqual(due.map((d) => d.event.id).sort(), ['tomorrow', 'weekly']);
});
test('IANA wall clocks resolve winter/summer offsets', () => {
  assert.equal(
    zonedDateTime('2026-07-01', '09:00', 'Europe/Warsaw').toISOString(),
    '2026-07-01T07:00:00.000Z',
  );
  assert.equal(
    zonedDateTime('2026-12-01', '09:00', 'Europe/Warsaw').toISOString(),
    '2026-12-01T08:00:00.000Z',
  );
});
test('assistant includes recurring events and all nested conflicts', async () => {
  const now = new Date('2026-10-26T08:00:00+01:00');
  const answer = await runLocalAiAssistant(
    'Co mam dzisiaj w planie?',
    [event({ title: 'Weekly meeting', recurrence: 'WEEKLY' })],
    'pl',
    now,
  );
  assert.match(answer.text, /Weekly meeting/);
  const conflict = await runLocalAiAssistant(
    'Sprawdź kolizje',
    [
      event({ id: 'a', title: 'A', endTime: '13:00', recurrence: 'WEEKLY' }),
      event({
        id: 'b',
        title: 'B',
        startTime: '10:00',
        endTime: '11:00',
        recurrence: 'WEEKLY',
      }),
      event({
        id: 'c',
        title: 'C',
        startTime: '12:00',
        endTime: '12:30',
        recurrence: 'WEEKLY',
      }),
    ],
    'pl',
    now,
  );
  assert.match(conflict.text, /„A”.*„C”/);
});
test('Christmas Eve is a statutory holiday from 2025', () => {
  assert.equal(
    getPolishHolidays(2026).some((h) => h.date === '2026-12-24'),
    true,
  );
  assert.equal(
    getPolishHolidays(2024).some((h) => h.date === '2024-12-24'),
    false,
  );
});
test('10,000 events are indexed by range with the same results as a date query', () => {
  const events = Array.from({ length: 10000 }, (_, i) => {
    const date = addDays('2026-01-01', i % 365);
    return event({
      id: String(i),
      startDate: date,
      endDate: date,
      recurrence: i % 10 === 0 ? 'WEEKLY' : 'NONE',
    });
  });
  const at = performance.now();
  const index = buildEventIndex(events, '2026-10-18', '2026-12-16');
  assert.equal(
    index.get('2026-10-18')?.length,
    buildEventIndex(events, '2026-10-18', '2026-10-18').get('2026-10-18')
      ?.length,
  );
  console.log(
    `10k event index: ${Math.round(performance.now() - at)} ms; ${[...index.values()].reduce((n, b) => n + b.length, 0)} occurrences`,
  );
});

test('source-zone midnight is rendered on the correct local day', () => {
  const e = event({
    startDate: '2026-10-19',
    endDate: '2026-10-19',
    startTime: '23:30',
    endTime: '23:45',
    timeZone: 'America/New_York',
  });
  assert.equal(buildEventIndex([e], '2026-10-19', '2026-10-19').size, 0);
  assert.equal(
    buildEventIndex([e], '2026-10-20', '2026-10-20').get('2026-10-20')![0]
      .startMinutes,
    5 * 60 + 30,
  );
});
test('ICS UNTIL uses the actual appointment time and round trips inclusive custom end dates', () => {
  const cutoff = event({
    rrule: 'FREQ=WEEKLY;UNTIL=20261026T075959Z',
    timeZone: 'UTC',
  });
  assert.equal(isEventOccurringOnDate(cutoff, '2026-10-26'), false);
  const custom = event({
    recurrence: 'CUSTOM',
    customRecurrence: {
      unit: 'DAY',
      interval: 1,
      endType: 'UNTIL_DATE',
      untilDate: '2026-10-21',
    },
  });
  const [restored] = parseICSToEvents(serializeICS([custom]));
  assert.equal(isEventOccurringOnDate(restored, '2026-10-21'), true);
  assert.equal(isEventOccurringOnDate(restored, '2026-10-22'), false);
});
test('NLP suggestions that cross midnight advance the ending date', () => {
  const result = extractEventFromPromptOffline(
    'Dodaj trening jutro o 23:30 na 2 godziny',
    new Date('2026-10-18T12:00:00+02:00'),
    'pl',
  );
  assert.ok(result);
  assert.equal(result.endDate, addDays(result.startDate, 1));
});

test('ICS start and end zones can differ without changing the instant of the end', () => {
  const [e] = parseICSToEvents(
    'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:zones\nDTSTART;TZID=Europe/Warsaw:20261019T090000\nDTEND:20261019T083000Z\nSUMMARY:Zone test\nEND:VEVENT\nEND:VCALENDAR',
  );
  assert.equal(e.endTime, '10:30');
  assert.equal(e.timeZone, 'Europe/Warsaw');
});
