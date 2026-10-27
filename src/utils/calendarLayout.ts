import { addDays, daysBetween, localDate, parseDate } from './dates';
import type { CalendarOccurrence } from './recurrence';

/** Floating calendar dates: weekday calculations never add local milliseconds. */
export function weekDates(date: string, startOfWeek = 1, length = 7) {
  const offset = (parseDate(date).getUTCDay() - startOfWeek + 7) % 7;
  const first = addDays(date, -offset);
  return Array.from({ length }, (_, i) => addDays(first, i));
}

export function monthDates(date: Date, startOfWeek = 1) {
  const first = localDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const start = weekDates(first, startOfWeek)[0];
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const length = Math.ceil((daysBetween(start, first) + count) / 7) * 7;
  return Array.from({ length }, (_, i) => addDays(start, i));
}

/** Keyboard date arithmetic uses UTC calendar fields, including month-end clamping. */
export function calendarDateTarget(date: string, key: string, startOfWeek = 1): string | null {
  const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 })[key];
  if (delta) return addDays(date, delta);
  if (key === 'Home' || key === 'End') return weekDates(date, startOfWeek)[key === 'Home' ? 0 : 6];
  if (key !== 'PageUp' && key !== 'PageDown') return null;
  const value = parseDate(date), day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + (key === 'PageUp' ? -1 : 1));
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last));
  return value.toISOString().slice(0, 10);
}

export const occurrenceKey = (o: CalendarOccurrence) => `${o.event.id}:${o.occurrenceDate}`;
export interface WeekSegment {
  key: string;
  occurrence: CalendarOccurrence;
  start: number;
  end: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Presentation only: every segment retains the original event, including recurrence. */
export function monthWeekSegments(days: string[], index: Map<string, CalendarOccurrence[]>) {
  const segments: WeekSegment[] = [];
  const active = new Map<string, WeekSegment>();
  days.forEach((date, day) => {
    for (const o of index.get(date) || []) {
      const key = occurrenceKey(o);
      const previous = active.get(key);
      if (previous && previous.end === day - 1) previous.end = day;
      else {
        const segment = { key: `${key}:${date}`, occurrence: o, start: day, end: day, lane: 0,
          continuesBefore: (index.get(addDays(date, -1)) || []).some(p => occurrenceKey(p) === key),
          continuesAfter: false };
        segments.push(segment);
        active.set(key, segment);
      }
    }
  });
  segments.sort((a, b) => a.start - b.start || b.end - a.end ||
    Number(b.occurrence.event.allDay) - Number(a.occurrence.event.allDay) ||
    a.occurrence.startMinutes - b.occurrence.startMinutes || a.key.localeCompare(b.key));
  const laneEnds: number[] = [];
  for (const s of segments) {
    let lane = laneEnds.findIndex(end => end < s.start);
    if (lane < 0) lane = laneEnds.length;
    s.lane = lane;
    laneEnds[lane] = s.end;
    s.continuesAfter = (index.get(addDays(days[s.end], 1)) || [])
      .some(o => occurrenceKey(o) === occurrenceKey(s.occurrence));
  }
  return segments;
}

export function agendaRows(index: Map<string, CalendarOccurrence[]>) {
  const rows: { date: string; occurrence?: CalendarOccurrence }[] = [];
  for (const [date, bucket] of [...index].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push({ date });
    for (const occurrence of bucket) rows.push({ date, occurrence });
  }
  return rows;
}
