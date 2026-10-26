import { addDays, timeString } from './dates';
import type { CalendarOccurrence } from './recurrence';

export function utcOffset(date: Date) {
  const minutes = -date.getTimezoneOffset();
  return `UTC${minutes >= 0 ? '+' : '−'}${Math.floor(Math.abs(minutes) / 60)}${minutes % 60 ? `:${String(Math.abs(minutes) % 60).padStart(2, '0')}` : ''}`;
}

/** Actual local-day duration: 23/25 hours on clock changes, also supporting half-hour shifts. */
export function timelineAxis(date: string) {
  const start = new Date(`${date}T00:00:00`).getTime();
  const end = new Date(`${addDays(date, 1)}T00:00:00`).getTime();
  const minutes = (end - start) / 60000;
  const ticks = Array.from({ length: Math.ceil(minutes / 60) }, (_, hour) => {
    const instant = new Date(start + hour * 3600000);
    return { elapsed: hour * 60, hour: instant.getHours(), label: timeString(instant.getHours() * 60 + instant.getMinutes()), offset: utcOffset(instant) };
  });
  return { start, end, minutes, ticks: ticks.map(tick => ({ ...tick,
    label: ticks.filter(t => t.label === tick.label).length > 1 ? `${tick.label} ${tick.offset}` : tick.label })) };
}

/** Keep presentation coordinates separate from the store's floating wall-clock minutes. */
export function timelineOccurrence(o: CalendarOccurrence, axis: ReturnType<typeof timelineAxis>) {
  const instant = (minutes: number) => minutes === 1440 ? axis.end :
    new Date(`${o.date}T${timeString(minutes)}:00`).getTime();
  return { ...o, source: o,
    startMinutes: (Math.max(axis.start, o.startInstant ?? instant(o.startMinutes)) - axis.start) / 60000,
    endMinutes: (Math.min(axis.end, o.endInstant ?? instant(o.endMinutes)) - axis.start) / 60000 };
}
