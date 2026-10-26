import { useMemo } from 'react';
import { MONTH_NAMES, DAY_NAMES_SHORT, type AppLanguage } from '../utils/i18n';
import type { CalendarEvent } from '../types';
import { eventDatePresence } from '../utils/recurrence';
import { localDate, locale } from '../utils/dates';
import { monthDates } from '../utils/calendarLayout';
import { calendarText } from '../utils/calendarText';
interface Props {
  currentDate: Date; language?: AppLanguage; now?: Date; events: CalendarEvent[];
  onSelectMonth: (month: number) => void; onSelectDay: (date: string) => void; startOfWeek?: number;
}
export function YearView({ currentDate, events, onSelectMonth, onSelectDay, language = 'en', now = new Date(), startOfWeek = 1 }: Props) {
  const year = currentDate.getFullYear(), today = localDate(now), zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const presence = useMemo(() => eventDatePresence(events, `${year}-01-01`, `${year}-12-31`), [events, year, zone]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, month) => monthDates(new Date(year, month, 1), startOfWeek)), [year, startOfWeek]);
  return <div className="calendar-year" data-testid="year-view">
    {months.map((dates, month) => <section key={month} className="calendar-panel year-month" data-testid="year-month">
      <button type="button" onClick={() => onSelectMonth(month)} className="year-month-heading">
        <strong>{MONTH_NAMES[language][month]}</strong><span>{year} →</span>
      </button>
      <div className="year-weekdays">{Array.from({ length: 7 }, (_, i) => {
        const day = DAY_NAMES_SHORT[language][(startOfWeek - 1 + i + 7) % 7];
        return <span key={day}>{day}</span>;
      })}</div>
      <div className="year-dates">{dates.map(date => Number(date.slice(5, 7)) !== month + 1 ? <span key={date} /> :
        <button type="button" key={date} onClick={() => onSelectDay(date)} data-date={date}
          aria-current={date === today ? 'date' : undefined}
          aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString(locale(language), { dateStyle: 'full' })}${presence.has(date) ? ` · ${calendarText(language).hasEvents}` : ''}`}
          className={date === today ? 'calendar-today' : ''}>
          {Number(date.slice(-2))}{presence.has(date) && <span className="year-event-dot" aria-hidden="true" />}
        </button>)}
      </div>
    </section>)}
  </div>;
}
