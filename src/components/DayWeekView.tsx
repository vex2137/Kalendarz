import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CalendarEvent, CalendarViewMode } from '../types';
import { buildEventIndex } from '../utils/recurrence';
import { addDays, localDate, locale } from '../utils/dates';
import { weekDates, monthWeekSegments } from '../utils/calendarLayout';
import { layoutOverlaps } from '../utils/layout';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { calendarText } from '../utils/calendarText';
import { occurrenceTime, occurrenceLabel } from './CalendarEventCard';
import { timelineAxis, timelineOccurrence } from '../utils/timeline';
interface Props {
  currentDate: Date; viewMode: CalendarViewMode; events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateAtTime: (date: string, time: string) => void;
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
  const [focusedSlot, setFocusedSlot] = useState('');
  const pendingFocus = useRef<string | null>(null);
  const initialDay = Math.max(0, days.indexOf(selected));
  const activeSlot = days.some((date, i) => axes[i].ticks.some(t => `${date}:${t.elapsed}` === focusedSlot))
    ? focusedSlot : `${days[initialDay]}:${axes[initialDay].ticks.find(t => t.hour === 8)?.elapsed ?? 0}`;
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    parent.current?.querySelector<HTMLElement>(`[data-slot="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });
  const moveSlot = (event: KeyboardEvent<HTMLButtonElement>, day: number, tick: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    let nextDay = day, nextTick = tick;
    if (event.key === 'ArrowUp') nextTick--;
    else if (event.key === 'ArrowDown') nextTick++;
    else if (event.key === 'Home') nextTick = 0;
    else if (event.key === 'End') nextTick = axes[day].ticks.length - 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      nextDay = Math.max(0, Math.min(days.length - 1, day + (event.key === 'ArrowLeft' ? -1 : 1)));
      const sameTime = axes[nextDay].ticks.findIndex(t => t.time === axes[day].ticks[tick].time);
      nextTick = sameTime >= 0 ? sameTime : tick;
    } else return;
    event.preventDefault();
    nextTick = Math.max(0, Math.min(axes[nextDay].ticks.length - 1, nextTick));
    const key = `${days[nextDay]}:${axes[nextDay].ticks[nextTick].elapsed}`;
    pendingFocus.current = key;
    setFocusedSlot(key);
  };
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
    <p id="timeline-keyboard-help" className="sr-only">{text.timeKeys}</p>
    <div className={`timeline-content ${!isDay ? 'timeline-week' : ''}`} style={{ '--day-count': days.length } as React.CSSProperties}>
      <div className="timeline-sticky-header">
        <div className="timeline-headings">
          <span className="timeline-zone" title={zone}>{zone.split('/').at(-1)?.replaceAll('_', ' ')}</span>
          {days.map(date => <button type="button" key={date} className={`timeline-date ${date === today ? 'calendar-today' : ''}`}
            aria-current={date === today ? 'date' : undefined} data-date={date}
            onClick={() => onSelectDay ? onSelectDay(date) : onCreateAtTime(date, '10:00')}>
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
          {axes[i].ticks.map((tick, tickIndex) => <button type="button" key={tick.elapsed}
            data-slot={`${date}:${tick.elapsed}`} tabIndex={activeSlot === `${date}:${tick.elapsed}` ? 0 : -1}
            aria-describedby="timeline-keyboard-help" onFocus={() => setFocusedSlot(`${date}:${tick.elapsed}`)}
            onKeyDown={event => moveSlot(event, i, tickIndex)}
            aria-label={`${t.create}: ${date} ${tick.label}`} onClick={() => onCreateAtTime(date, tick.time)}
            className="timeline-hour" style={{ top: tick.elapsed * scale, height: Math.min(60, axes[i].minutes - tick.elapsed) * scale }}>
            {mixedAxes && <span className="timeline-column-hour" aria-hidden="true">{tick.label}</span>}
          </button>)}
          {date === today && <div className="timeline-now" data-testid="current-time" aria-label={`${text.currentTime}: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`}
            style={{ top: (now.getTime() - axes[i].start) / 60000 * scale }} />}
          {positions[i].map(o => <button type="button" key={`${o.event.id}:${o.occurrenceDate}`}
            data-event-id={o.event.id} data-start-minutes={o.startMinutes} data-end-minutes={o.endMinutes}
            className="timeline-event" onClick={() => onSelectEvent(o.event)}
            aria-label={occurrenceLabel(o.source, language)}
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
