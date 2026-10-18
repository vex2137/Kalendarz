import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCalendar,
  commitCalendar,
  mergeRecords,
} from '../src/utils/calendarStore';
import { event, memoryStorage } from './fixtures';
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage() });
test('migration retains a backup; imports merge; stale sync cannot revive deletions', async () => {
  localStorage.setItem('offline_calendar_events_v2', JSON.stringify([event()]));
  assert.equal((await loadCalendar()).events.length, 1);
  assert.ok(localStorage.getItem('offline_calendar_events_v2'));
  await commitCalendar([event({ id: 'imported' })]);
  assert.equal((await loadCalendar()).events.length, 2);
  await commitCalendar([], [{ id: 'event', updatedAt: 20 }]);
  await commitCalendar([event({ updatedAt: 10 })]);
  assert.deepEqual(
    (await loadCalendar()).events.map((e) => e.id),
    ['imported'],
  );
  await commitCalendar([event({ updatedAt: 21 })]);
  assert.equal((await loadCalendar()).events.length, 2);
});
test('concurrent non-overlapping changes are preserved transactionally', async () => {
  await Promise.all([
    commitCalendar([event({ id: 'tab-a' })]),
    commitCalendar([event({ id: 'tab-b' })]),
  ]);
  const ids = (await loadCalendar()).events.map((e) => e.id);
  assert.ok(ids.includes('tab-a') && ids.includes('tab-b'));
});
test('invalid import is atomic and leaves existing events intact', async () => {
  const before = (await loadCalendar()).events;
  await assert.rejects(
    commitCalendar([event({ id: 'valid' }), { id: 'invalid' } as any]),
  );
  assert.deepEqual((await loadCalendar()).events, before);
});
test('equal timestamps converge and deletion wins a tie', () => {
  const a = { id: 'x', updatedAt: 1, event: event({ id: 'x', title: 'A' }) },
    b = { id: 'x', updatedAt: 1, event: event({ id: 'x', title: 'B' }) };
  assert.deepEqual(mergeRecords([a], [b]), mergeRecords([b], [a]));
  assert.equal(
    mergeRecords([a], [{ id: 'x', updatedAt: 1 }])[0].event,
    undefined,
  );
});
