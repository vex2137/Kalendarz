import { useEffect, useMemo, useRef } from 'react';
import type { CalendarEvent, CalendarViewMode } from '../types';
import { buildEventIndex } from '../utils/recurrence';
import { addDays, localDate, locale } from '../utils/dates';
import { weekDates, monthWeekSegments } from '../utils/calendarLayout';
import { layoutOverlaps } from '../utils/layout';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { calendarText } from '../utils/calendarText';
import { occurrenceTime } from './CalendarEventCard';
import { timelineAxis, timelineOccurrence } from '../utils/timeline';
interface Props {
  currentDate: Date; viewMode: CalendarViewMode; events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateAtTime: (date: string, hour: number) => void;
  onSelectDay?: (date: string) => void;
  language?: AppLanguage; now?: Date; startOfWeek?: number;
}
const hourHeight = 64, scale = hourHeight / 60;
export function DayWeekView({ currentDate, viewMode, events, onSelectEvent, onCreateAtTime, onSelectDay,
  language = 'en', now = new Date(), startOfWeek = 1 }: Props) {
  const t = getTranslation(language), text = calendarText(language), today = localDate(now), selected = localDate(currentDate);
  const isDay = viewMode === 'day';
  const days = useMemo(() => isDay ? [selected] : weekDates(selected, startOfWeek), [selected, isDay, startOfWeek]);
  const from = days[0], to = days.at(-1)!;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const index = useMemo(() => buildEventIndex(events, addDays(from, -1), addDays(to, 1)), [events, from, to, zone]);
  const axes = useMemo(() => days.map(timelineAxis), [days, zone]);
  const timelineMinutes = Math.max(...axes.map(axis => axis.minutes));
  const mixedAxes = new Set(axes.map(axis => axis.minutes)).size > 1;
  const positions = useMemo(() => days.map((date, i) => layoutOverlaps((index.get(date) || []).filter(o => !o.event.allDay).map(o => timelineOccurrence(o, axes[i])), 18 / scale)), [index, days, axes]);
  const allDaySegments = useMemo(() => monthWeekSegments(days,
    new Map([...index].map(([date, bucket]) => [date, bucket.filter(o => o.event.allDay)]))), [index, days]);
  const allDayLanes = allDaySegments.reduce((count, segment) => Math.max(count, segment.lane + 1), 0);
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = parent.current;
    if (!root) return;
    const currentAxis = axes[days.indexOf(today)];
    root.scrollTop = Math.max(0, (Math.floor(currentAxis ? (now.getTime() - currentAxis.start) / 3600000 : 8) - 1) * hourHeight);
    const current = days.indexOf(today);
    if (!isDay && current >= 0) root.scrollLeft = Math.max(0, 52 + current * 112 - root.clientWidth / 2);
  }, [from, isDay, zone]);
  return <div ref={parent} className={`calendar-panel calendar-timeline ${!isDay ? 'calendar-week-scroller' : ''}`}
    data-no-swipe={!isDay ? '' : undefined} data-testid="time-view" aria-label={isDay ? t.day : t.week}>
    <div className={`timeline-content ${!isDay ? 'timeline-week' : ''}`} style={{ '--day-count': days.length } as React.CSSProperties}>
      <div className="timeline-sticky-header">
        <div className="timeline-headings">
          <span className="timeline-zone" title={zone}>{zone.split('/').at(-1)?.replaceAll('_', ' ')}</span>
          {days.map(date => <button type="button" key={date} className={`timeline-date ${date === today ? 'calendar-today' : ''}`}
            aria-current={date === today ? 'date' : undefined} data-date={date}
            onClick={() => onSelectDay ? onSelectDay(date) : onCreateAtTime(date, 10)}>
            <span>{new Date(`${date}T12:00:00`).toLocaleDateString(locale(language), { weekday: 'short' })}</span>
            <strong>{new Date(`${date}T12:00:00`).toLocaleDateString(locale(language), { day: 'numeric', month: 'short' })}</strong>
          </button>)}
        </div>
        <div className="timeline-all-day-row">
          <span className="timeline-all-day-label">{t.allDay}</span>
          <div className="timeline-all-day" aria-label={t.allDay} style={{ minHeight: Math.max(32, Math.min(4, allDayLanes) * 28) }}>
            {allDaySegments.map(s => <button type="button" key={s.key} className="month-segment timeline-all-day-event"
              data-event-id={s.occurrence.event.id} style={{ gridColumn: `${s.start + 1}/${s.end + 2}`, gridRow: s.lane + 1,
                '--event-color': GOOGLE_CALENDAR_COLORS[s.occurrence.event.color].dot } as React.CSSProperties}
              onClick={() => onSelectEvent(s.occurrence.event)} title={`${t.allDay}: ${s.occurrence.event.title}`}>
              {s.continuesBefore ? '‹ ' : ''}{s.occurrence.event.title}{s.continuesAfter ? ' ›' : ''}
            </button>)}
          </div>
        </div>
      </div>
      <div className="timeline-body" style={{ height: timelineMinutes * scale }}>
        <div className="timeline-hours" aria-hidden="true">
          {!mixedAxes && axes[0].ticks.map(tick => <span key={tick.elapsed} style={{ top: tick.elapsed * scale }}>{tick.label}</span>)}
        </div>
        {days.map((date, i) => <div key={date} role="group" aria-label={date} className={`timeline-day ${date === today ? 'timeline-today-column' : ''}`} style={{ height: axes[i].minutes * scale }}>
          {axes[i].ticks.map(tick => <button type="button" key={tick.elapsed}
            aria-label={`${t.create}: ${date} ${tick.label}`} onClick={() => onCreateAtTime(date, tick.hour)}
            className="timeline-hour" style={{ top: tick.elapsed * scale, height: Math.min(60, axes[i].minutes - tick.elapsed) * scale }}>
            {mixedAxes && <span className="timeline-column-hour" aria-hidden="true">{tick.label}</span>}
          </button>)}
          {date === today && <div className="timeline-now" data-testid="current-time" aria-label={`${text.currentTime}: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`}
            style={{ top: (now.getTime() - axes[i].start) / 60000 * scale }} />}
          {positions[i].map(o => <button type="button" key={`${o.event.id}:${o.occurrenceDate}`}
            data-event-id={o.event.id} data-start-minutes={o.startMinutes} data-end-minutes={o.endMinutes}
            className="timeline-event" onClick={() => onSelectEvent(o.event)}
            style={{ top: o.startMinutes * scale, height: Math.max(18, (o.endMinutes - o.startMinutes) * scale),
              left: `calc(${o.column / o.columns * 100}% + 2px)`, width: `calc(${100 / o.columns}% - 4px)`,
              '--event-color': GOOGLE_CALENDAR_COLORS[o.event.color].dot } as React.CSSProperties}
            title={`${o.event.title} · ${occurrenceTime(o.source, language)}${o.event.description ? ` · ${o.event.description}` : ''}`}>
            <strong>{o.event.title}</strong><span>{occurrenceTime(o.source, language)}</span>
            {o.endMinutes - o.startMinutes >= 60 && o.event.description && <p>{o.event.description}</p>}
          </button>)}
        </div>)}
      </div>
    </div>
  </div>;
}
