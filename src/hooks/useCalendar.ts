import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../types';
import {
  commitCalendar,
  loadCalendar,
  signalCalendarChange,
  type Deletion,
} from '../utils/calendarStore';

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deletions, setDeletions] = useState<Deletion[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const queue = useRef(Promise.resolve());
  const clock = useRef(0);
  const refresh = useCallback(async () => {
    try {
      const data = await loadCalendar();
      clock.current = Math.max(
        clock.current,
        ...data.events.map((e) => e.updatedAt),
        ...data.deletions.map((d) => d.updatedAt),
      );
      setEvents((previous) =>
        previous.length === data.events.length &&
        previous.every(
          (event, i) =>
            JSON.stringify(event) === JSON.stringify(data.events[i]),
        )
          ? previous
          : data.events,
      );
      setDeletions(data.deletions);
      setReady(true);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    const changed = (e: StorageEvent) => {
      if (e.key === 'offline_calendar_revision') void refresh().catch(() => {});
    };
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('offline-calendar')
        : null;
    const reload = () => void refresh().catch(() => {});
    if (channel) channel.onmessage = reload;
    window.addEventListener('storage', changed);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', reload);
      channel?.close();
    };
  }, [refresh]);
  const commit = useCallback(
    (
      incoming: CalendarEvent[] = [],
      removed: Deletion[] = [],
      local = false,
    ) => {
      const operation = queue.current
        .catch(() => {})
        .then(async () => {
          if (local) {
            clock.current = Math.max(clock.current + 1, Date.now());
            incoming = incoming.map((e) => ({
              ...e,
              updatedAt: clock.current,
            }));
            removed = removed.map((d) => ({ ...d, updatedAt: clock.current }));
          }
          await commitCalendar(incoming, removed);
          await refresh();
          signalCalendarChange();
          setError('');
        });
      queue.current = operation;
      void operation.catch((e) =>
        setError(`Nie zapisano danych / Data was not saved: ${String(e)}`),
      );
      return operation;
    },
    [refresh],
  );
  const remove = useCallback(
    (ids: string[]) =>
      commit(
        [],
        ids.map((id) => ({ id, updatedAt: Date.now() })),
        true,
      ),
    [commit],
  );
  const save = useCallback(
    (incoming: CalendarEvent[]) => commit(incoming, [], true),
    [commit],
  );
  return { events, deletions, ready, error, commit, save, remove, refresh };
}
