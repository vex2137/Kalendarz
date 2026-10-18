import { openDB } from 'idb';
import type { CalendarEvent } from '../types';
import { validateEvent, validateEvents } from './validation';
import { generateHolidayEvents } from './holidays';

export interface Deletion {
  id: string;
  updatedAt: number;
}
interface RecordValue {
  id: string;
  updatedAt: number;
  event?: CalendarEvent;
}
const database = () =>
  openDB('offline-calendar', 1, {
    upgrade(db) {
      db.createObjectStore('records', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
let dbPromise: ReturnType<typeof database> | undefined;
const db = () => (dbPromise ||= database());
export function mergeRecords(
  current: RecordValue[],
  incoming: RecordValue[],
): RecordValue[] {
  const records = new Map(current.map((r) => [r.id, r]));
  for (const value of incoming) {
    const previous = records.get(value.id);
    // Deletions win ties. Conflicting edits converge regardless of import order.
    if (
      !previous ||
      value.updatedAt > previous.updatedAt ||
      (value.updatedAt === previous.updatedAt &&
        (!value.event ||
          (previous.event &&
            JSON.stringify(value.event) > JSON.stringify(previous.event))))
    )
      records.set(value.id, value);
  }
  return [...records.values()];
}
export async function loadCalendar(): Promise<{
  events: CalendarEvent[];
  deletions: Deletion[];
}> {
  const database = await db();
  if (!(await database.get('meta', 'migrated'))) {
    const legacy = localStorage.getItem('offline_calendar_events_v2');
    const events =
      legacy === null
        ? generateHolidayEvents()
        : validateEvents(JSON.parse(legacy));
    const tx = database.transaction(['records', 'meta'], 'readwrite');
    void tx.done.catch(() => {});
    for (const event of events)
      await tx
        .objectStore('records')
        .put({ id: event.id, updatedAt: event.updatedAt, event });
    await tx.objectStore('meta').put(true, 'migrated');
    await tx.done;
    // Keep the old data as a migration backup; never silently delete user data.
  }
  const records = (await database.getAll('records')) as RecordValue[];
  return {
    events: records.flatMap((r) => (r.event ? [validateEvent(r.event)] : [])),
    deletions: records
      .filter((r) => !r.event)
      .map(({ id, updatedAt }) => ({ id, updatedAt })),
  };
}
export async function commitCalendar(
  events: CalendarEvent[] = [],
  deletions: Deletion[] = [],
) {
  validateEvents(events);
  if (
    deletions.length > 50000 ||
    deletions.some(
      (d) =>
        typeof d.id !== 'string' ||
        !d.id ||
        !Number.isFinite(d.updatedAt) ||
        d.updatedAt < 0 ||
        d.updatedAt > Date.now() + 86400000,
    )
  )
    throw new Error('Invalid deletions');
  const database = await db();
  const tx = database.transaction('records', 'readwrite');
  void tx.done.catch(() => {});
  const changes: RecordValue[] = [
    ...events.map((event) => ({
      id: event.id,
      updatedAt: event.updatedAt,
      event,
    })),
    ...deletions.map(({ id, updatedAt }) => ({ id, updatedAt })),
  ];
  for (const incoming of changes) {
    const previous = (await tx.store.get(incoming.id)) as
      | RecordValue
      | undefined;
    const winner = mergeRecords(previous ? [previous] : [], [incoming])[0];
    if (winner !== previous) await tx.store.put(winner);
  }
  await tx.done;
}

export function signalCalendarChange() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('offline-calendar');
    channel.postMessage('changed');
    channel.close();
  }
  try {
    localStorage.setItem('offline_calendar_revision', crypto.randomUUID());
  } catch {
    /* IndexedDB committed successfully; BroadcastChannel/focus refresh still work. */
  }
}
