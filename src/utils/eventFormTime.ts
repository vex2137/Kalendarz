import type { CalendarEvent } from '../types';
import { wallDateTime, zonedDateTime } from './timezone';

/** Editor guard only: keep existing stored/imported events and recurrence rules intact. */
export function hasNewNonexistentTime(event: CalendarEvent, original?: CalendarEvent | null) {
  if (event.allDay) return false;
  const unchanged = original && !original.allDay &&
    (['startDate', 'endDate', 'startTime', 'endTime', 'timeZone'] as const).every(key => event[key] === original[key]);
  if (unchanged) return false;
  return ([[event.startDate, event.startTime!], [event.endDate, event.endTime!]] as const).some(([date, time]) => {
    const wall = wallDateTime(zonedDateTime(date, time, event.timeZone), event.timeZone);
    return wall.date !== date || wall.time !== time;
  });
}
