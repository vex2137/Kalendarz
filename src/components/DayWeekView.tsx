import React, { useMemo } from 'react';
import type { CalendarEvent, CalendarViewMode } from '../types';
import { buildEventIndex } from '../utils/recurrence';
import { addDays, localDate, locale } from '../utils/dates';
import { layoutOverlaps } from '../utils/layout';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { getTranslation, type AppLanguage } from '../utils/i18n';
interface Props {
  currentDate: Date;
  viewMode: CalendarViewMode;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onCreateAtTime: (date: string, hour: number) => void;
  language?: AppLanguage;
  now?: Date;
}
export function DayWeekView({
  currentDate,
  viewMode,
  events,
  onSelectEvent,
  onCreateAtTime,
  language = 'pl',
  now = new Date(),
}: Props) {
  const t = getTranslation(language),
    today = localDate(now),
    selected = localDate(currentDate);
  const from =
    viewMode === 'day'
      ? selected
      : addDays(selected, -((currentDate.getDay() + 6) % 7));
  const days = Array.from({ length: viewMode === 'day' ? 1 : 7 }, (_, i) =>
    addDays(from, i),
  );
  const index = useMemo(
    () => buildEventIndex(events, from, days.at(-1)!),
    [events, from, viewMode],
  );
  const positions = useMemo(
    () =>
      days.map((date) =>
        layoutOverlaps((index.get(date) || []).filter((o) => !o.event.allDay)),
      ),
    [index],
  );
  return (
    <div className="flex-1 min-h-0 overflow-auto theme-surface theme-border border rounded-2xl">
      <div
        className="sticky top-0 z-30 theme-header grid pl-12 border-b theme-border"
        style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}
      >
        {days.map((date) => (
          <div key={date} className="text-center p-1 text-xs min-w-0">
            <button
              onClick={() => onCreateAtTime(date, 10)}
              className={`rounded p-1 ${date === today ? 'theme-accent-fill bg-blue-600 text-white' : ''}`}
            >
              {new Date(`${date}T12:00:00`).toLocaleDateString(
                locale(language),
                { weekday: 'short', day: 'numeric' },
              )}
            </button>
            <div aria-label={t.allDay} className="max-h-24 overflow-y-auto">
              {(index.get(date) || [])
                .filter((o) => o.event.allDay)
                .map((o) => (
                  <button
                    key={`${o.event.id}-${o.occurrenceDate}`}
                    onClick={() => onSelectEvent(o.event)}
                    className="block w-full truncate text-left rounded my-1 p-1 theme-subtle"
                    title={`${t.allDay}: ${o.event.title}`}
                  >
                    {o.event.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="relative flex" style={{ height: 1440 }}>
        <div className="w-12 shrink-0 relative" aria-hidden="true">
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={hour}
              className="absolute right-1 text-[10px] theme-muted"
              style={{ top: hour * 60 }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 min-w-0"
          style={{
            gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
          }}
        >
          {days.map((date, i) => (
            <div
              key={date}
              role="group"
              aria-label={date}
              className="relative border-l theme-border"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <button
                  key={hour}
                  aria-label={`${t.create}: ${date} ${hour}:00`}
                  onClick={() => onCreateAtTime(date, hour)}
                  className="absolute left-0 right-0 h-[60px] border-t theme-border hover:bg-blue-500/5"
                  style={{ top: hour * 60 }}
                />
              ))}
              {date === today && (
                <div
                  className="absolute left-0 right-0 h-px bg-red-500 z-20 pointer-events-none"
                  style={{ top: now.getHours() * 60 + now.getMinutes() }}
                />
              )}
              {positions[i].map((o) => (
                <button
                  key={`${o.event.id}-${o.occurrenceDate}`}
                  onClick={() => onSelectEvent(o.event)}
                  className="absolute rounded border border-white/30 overflow-hidden text-left p-0.5 text-[10px]"
                  style={{
                    top: o.startMinutes,
                    height: Math.max(16, o.endMinutes - o.startMinutes),
                    left: `${(o.column / o.columns) * 100}%`,
                    width: `${100 / o.columns}%`,
                    background: GOOGLE_CALENDAR_COLORS[o.event.color].dot,
                    color: '#fff',
                  }}
                  title={`${o.event.title} (${o.event.startTime} – ${o.event.endTime})`}
                >
                  <span className="block truncate font-semibold">
                    {o.event.title}
                  </span>
                  <span>{o.event.startTime}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
