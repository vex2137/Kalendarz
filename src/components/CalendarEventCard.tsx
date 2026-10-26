import type { CalendarEvent } from '../types';
import type { CalendarOccurrence } from '../utils/recurrence';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { localDate, timeString } from '../utils/dates';
import { calendarText } from '../utils/calendarText';
import { utcOffset } from '../utils/timeline';

export function occurrenceTime(o: CalendarOccurrence, language: AppLanguage) {
  if (!o.event.allDay && o.startInstant !== undefined && o.endInstant !== undefined) {
    const start = new Date(o.startInstant), end = new Date(o.endInstant);
    const time = (date: Date) => timeString(date.getHours() * 60 + date.getMinutes());
    const endTime = o.date !== localDate(end) ? '24:00' : time(end);
    return `${time(start)} – ${endTime}${start.getTimezoneOffset() !== end.getTimezoneOffset() ? ` (${utcOffset(start)} → ${utcOffset(end)})` : ''}`;
  }
  return o.event.allDay ? getTranslation(language).allDay :
    `${timeString(o.startMinutes)} – ${o.endMinutes === 1440 ? '24:00' : timeString(o.endMinutes)}`;
}

/** Text uses theme contrast; event color remains an identifying stripe. */
export function CalendarEventCard({ occurrence: o, language, onSelectEvent }: {
  occurrence: CalendarOccurrence; language: AppLanguage; onSelectEvent: (event: CalendarEvent) => void;
}) {
  const event = o.event;
  return <button type="button" onClick={() => onSelectEvent(event)}
    className="calendar-event-card" data-event-id={event.id}
    style={{ '--event-color': GOOGLE_CALENDAR_COLORS[event.color].dot } as React.CSSProperties}>
    <span className="calendar-event-time">{occurrenceTime(o, language)}</span>
    <span className="min-w-0">
      <span className="calendar-event-title">{event.title}</span>
      <span className="calendar-event-meta">
        {event.startDate !== event.endDate && <span>{calendarText(language).continues} · </span>}
        {o.date}{event.location ? ` · ${event.location}` : ''}
        {(event.recurrence !== 'NONE' || event.rrule) && <span aria-label={getTranslation(language).repeat}> ↻</span>}
      </span>
      {event.description && <span className="calendar-event-description">{event.description}</span>}
    </span>
  </button>;
}
