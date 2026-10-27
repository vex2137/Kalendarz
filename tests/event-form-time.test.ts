import test from 'node:test';
import assert from 'node:assert/strict';
import { event } from './fixtures';
import { hasNewNonexistentTime } from '../src/utils/eventFormTime';

test('editor rejects new floating and named-zone spring-gap inputs, including half-hour gaps', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Warsaw';
    const gap = event({ startDate: '2026-03-29', endDate: '2026-03-29', startTime: '02:30', endTime: '04:00' });
    assert.equal(hasNewNonexistentTime(gap), true);
    assert.equal(hasNewNonexistentTime({ ...gap, timeZone: 'Europe/Warsaw' }), true);
    assert.equal(hasNewNonexistentTime({ ...gap, startTime: '01:30', endTime: '02:30' }), true);
    assert.equal(hasNewNonexistentTime({ ...gap, startTime: '03:30' }), false);
    assert.equal(hasNewNonexistentTime({ ...gap, timeZone: 'UTC' }), false);
    const halfHour = event({ startDate: '2026-10-04', endDate: '2026-10-04', startTime: '02:15', endTime: '03:00', timeZone: 'Australia/Lord_Howe' });
    assert.equal(hasNewNonexistentTime(halfHour), true);
    assert.equal(hasNewNonexistentTime({ ...halfHour, startTime: '02:30' }), false);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('guard preserves imported gap timestamps, all-day dates and existing fold resolution', () => {
  const gap = event({ startDate: '2026-03-29', endDate: '2026-03-29', startTime: '02:30', endTime: '04:00', timeZone: 'Europe/Warsaw' });
  assert.equal(hasNewNonexistentTime({ ...gap, title: 'Edited title' }, gap), false);
  assert.equal(hasNewNonexistentTime({ ...gap, startTime: '02:45' }, gap), true);
  assert.equal(hasNewNonexistentTime({ ...gap, allDay: true }), false);
  assert.equal(hasNewNonexistentTime(event({ startDate: '2026-10-25', endDate: '2026-10-25', startTime: '02:30', endTime: '03:30', timeZone: 'Europe/Warsaw' })), false);
});
