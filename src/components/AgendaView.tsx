import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CalendarEvent } from '../types';
import { buildEventIndex, type CalendarOccurrence } from '../utils/recurrence';
import { addDays, localDate, locale, timeString } from '../utils/dates';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { getTranslation, type AppLanguage } from '../utils/i18n';
interface Props {
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSelectDay: (date: string) => void;
  language?: AppLanguage;
  now?: Date;
}
export function AgendaView({
  events,
  onSelectEvent,
  onSelectDay,
  language = 'pl',
  now = new Date(),
}: Props) {
  const today = localDate(now),
    t = getTranslation(language);
  const rows = useMemo(() => {
    const index = buildEventIndex(events, today, addDays(today, 59));
    const result: { date: string; occurrence?: CalendarOccurrence }[] = [];
    for (const [date, bucket] of [...index].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      result.push({ date });
      for (const occurrence of bucket) result.push({ date, occurrence });
    }
    return result;
  }, [events, today]);
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: (i) => (rows[i].occurrence ? 78 : 44),
    overscan: 6,
    getItemKey: (i) =>
      rows[i].occurrence
        ? `${rows[i].date}-${rows[i].occurrence!.occurrenceDate}-${rows[i].occurrence!.event.id}`
        : rows[i].date,
  });
  return (
    <div
      ref={parent}
      className="flex-1 min-h-0 overflow-auto p-2 sm:p-4"
      aria-label={t.agenda}
    >
      {!rows.length && (
        <p className="p-8 text-center theme-muted">{t.noEvents}</p>
      )}
      <div
        className="relative max-w-3xl mx-auto"
        style={{ height: virtual.getTotalSize() }}
      >
        {virtual.getVirtualItems().map((item) => {
          const row = rows[item.index],
            occurrence = row.occurrence,
            event = occurrence?.event;
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtual.measureElement}
              className="absolute left-0 w-full pb-2"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {event ? (
                <button
                  onClick={() => onSelectEvent(event)}
                  className="w-full text-left theme-surface theme-border border rounded-xl p-3 flex gap-3 items-center"
                >
                  <span
                    className="w-1 h-10 rounded shrink-0"
                    style={{
                      background: GOOGLE_CALENDAR_COLORS[event.color].dot,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">
                      {event.title}
                    </span>
                    <span className="block text-xs theme-muted">
                      {event.allDay
                        ? t.allDay
                        : `${timeString(occurrence!.startMinutes)} – ${occurrence!.endMinutes === 1440 ? '24:00' : timeString(occurrence!.endMinutes)}`}
                      {event.location ? ` · ${event.location}` : ''}
                    </span>
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => onSelectDay(row.date)}
                  className="font-semibold text-sm py-2 text-left"
                >
                  {row.date === today ? `${t.today} · ` : ''}
                  {new Date(`${row.date}T12:00:00`).toLocaleDateString(
                    locale(language),
                    {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    },
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
