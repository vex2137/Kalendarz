import { useMemo } from 'react';
import type { CalendarEvent } from '../types';
import { buildEventIndex } from '../utils/recurrence';
import { addDays, localDate, locale, timeString } from '../utils/dates';
import { monthDates, monthWeekSegments } from '../utils/calendarLayout';
import { calendarText } from '../utils/calendarText';
import { DAY_NAMES_SHORT, getTranslation, type AppLanguage } from '../utils/i18n';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { AgendaView } from './AgendaView';

interface Props {
  currentDate: Date; language?: AppLanguage; now?: Date; events: CalendarEvent[];
  onSelectDay: (date: string) => void; onSelectEvent: (event: CalendarEvent) => void;
  startOfWeek?: number;
  onFocusDate: (date: string | null) => void;
  selectedDate?: string | null;
}
export function MonthView({ currentDate, events, onSelectDay, onSelectEvent, onFocusDate, selectedDate: selected = null, language = 'en', now = new Date(), startOfWeek = 1 }: Props) {
  const month = localDate(currentDate).slice(0, 7), today = localDate(now);
  const dates = useMemo(() => monthDates(currentDate, startOfWeek), [month, startOfWeek]);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const index = useMemo(() => buildEventIndex(events, addDays(dates[0], -1), addDays(dates.at(-1)!, 1)), [events, dates, zone]);
  const weeks = useMemo(() => Array.from({ length: dates.length / 7 }, (_, i) => {
    const days = dates.slice(i * 7, i * 7 + 7);
    return { days, segments: monthWeekSegments(days, index) };
  }), [dates, index]);
  const text = calendarText(language), t = getTranslation(language);
  const toggle = (date: string) => {
    onFocusDate(selected === date ? null : date);
  };
  const defaultStart = month === today.slice(0, 7) ? today : `${month}-01`;
  const dayNames = Array.from({ length: 7 }, (_, i) => DAY_NAMES_SHORT[language][(startOfWeek - 1 + i + 7) % 7]);
  return <div className="month-view" data-testid="month-view" data-month={month}>
    <section className="calendar-panel month-grid" aria-label={t.month}>
      <div className="month-weekdays">{dayNames.map(day => <span key={day}>{day}</span>)}</div>
      {weeks.map(({ days, segments }) => <div className="month-week" data-testid="month-week" key={days[0]}>
        <div className="month-dates">
          {days.map((date, day) => {
            const bucket = index.get(date) || [], outside = date.slice(0, 7) !== month;
            const hidden = (limit: number) => segments.filter(s => s.start <= day && s.end >= day && s.lane >= limit).length;
            return <button type="button" key={date} id={`calendar-cell-${date}`}
              data-date={date} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined}
              aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString(locale(language), { dateStyle: 'full' })}, ${bucket.length} ${text.events}`}
              onClick={() => toggle(date)}
              className={`month-date ${outside ? 'month-date-outside' : ''} ${date === today ? 'calendar-today' : ''} ${date === selected ? 'calendar-selected' : ''}`}>
              <span className="month-number">{Number(date.slice(-2))}</span>
              {bucket.length > 0 && <span className="month-count" aria-hidden="true">{bucket.length}</span>}
              {hidden(2) > 0 && <span className="month-overflow month-overflow-mobile">+{hidden(2)} {text.more}</span>}
              {hidden(3) > 0 && <span className="month-overflow month-overflow-desktop">+{hidden(3)} {text.more}</span>}
            </button>;
          })}
        </div>
        <div className="month-segments">
          {segments.filter(s => s.lane < 3).map(s => {
            const event = s.occurrence.event;
            return <button type="button" key={s.key} data-event-id={event.id} data-lane={s.lane}
              data-start={s.start} data-end={s.end}
              className={`month-segment ${s.continuesBefore ? 'segment-before' : ''} ${s.continuesAfter ? 'segment-after' : ''}`}
              style={{ gridColumn: `${s.start + 1} / ${s.end + 2}`, gridRow: s.lane + 1,
                '--event-color': GOOGLE_CALENDAR_COLORS[event.color].dot } as React.CSSProperties}
              title={`${event.title} · ${event.allDay ? t.allDay : timeString(s.occurrence.startMinutes)}${s.continuesBefore || s.continuesAfter ? ` · ${text.continues}` : ''}`}
              onClick={() => onSelectEvent(event)}>
              {s.continuesBefore && <span aria-hidden="true">‹ </span>}
              {!event.allDay && <span className="month-event-time">{timeString(s.occurrence.startMinutes)} </span>}
              {event.title}{s.continuesAfter && <span aria-hidden="true"> ›</span>}
            </button>;
          })}
        </div>
      </div>)}
    </section>
    <section className="calendar-panel month-agenda" aria-labelledby="month-events-heading">
      <div className="calendar-section-heading">
        <h3 id="month-events-heading" aria-live="polite">{selected ? new Date(`${selected}T12:00:00`).toLocaleDateString(locale(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : text.upcoming}</h3>
        {selected && <button type="button" className="calendar-button" onClick={() => onSelectDay(selected)}>{text.openDay} →</button>}
      </div>
      <AgendaView key={selected || defaultStart} events={events} language={language} now={now}
        startDate={selected || defaultStart} endDate={selected || undefined} emptyMessage={selected ? text.noDayEvents : undefined}
        onSelectEvent={onSelectEvent} onSelectDay={onSelectDay} embedded />
    </section>
  </div>;
}
