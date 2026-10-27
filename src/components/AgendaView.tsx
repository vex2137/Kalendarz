import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer, defaultRangeExtractor } from '@tanstack/react-virtual';
import type { CalendarEvent } from '../types';
import { buildEventIndex } from '../utils/recurrence';
import { addDays, localDate, locale } from '../utils/dates';
import { agendaRows } from '../utils/calendarLayout';
import { calendarText } from '../utils/calendarText';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { CalendarEventCard } from './CalendarEventCard';
interface Props {
  events: CalendarEvent[]; onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (date: string) => void; language?: AppLanguage; now?: Date;
  startDate?: string; endDate?: string; emptyMessage?: string; embedded?: boolean;
}
export function AgendaView({ events, onSelectEvent, onSelectDay, language = 'en', now = new Date(),
  startDate = localDate(now), endDate, emptyMessage, embedded = false }: Props) {
  const today = localDate(now), t = getTranslation(language), text = calendarText(language);
  const [range, setRange] = useState({ start: startDate, length: 60 });
  const length = range.start === startDate ? range.length : 60;
  const until = endDate || addDays(startDate, length - 1);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = useMemo(() => agendaRows(buildEventIndex(events, startDate, until)), [events, startDate, until, zone]);
  const parent = useRef<HTMLDivElement>(null);
  const [focusedRow, setFocusedRow] = useState(0);
  const activeRow = Math.min(focusedRow, Math.max(0, rows.length - 1));
  const pendingFocus = useRef(false), helpId = useId();
  useEffect(() => { setFocusedRow(0); if (parent.current) parent.current.scrollTop = 0; }, [startDate, endDate]);
  const virtual = useVirtualizer({
    count: rows.length, getScrollElement: () => parent.current,
    useAnimationFrameWithResizeObserver: true,
    estimateSize: i => rows[i].occurrence ? 100 : 52, overscan: 6,
    getItemKey: i => rows[i].occurrence ? `${rows[i].date}:${rows[i].occurrence!.occurrenceDate}:${rows[i].occurrence!.event.id}` : rows[i].date,
    // Keep the focused row mounted when scrolling with a mouse or touch.
    rangeExtractor: useCallback(range => [...new Set([...defaultRangeExtractor(range), activeRow])].filter(i => i < rows.length).sort((a, b) => a - b), [activeRow, rows.length]),
  });
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const button = parent.current?.querySelector<HTMLElement>(`[data-agenda-row="${activeRow}"] button`);
    if (button) { button.focus({ preventScroll: true }); button.scrollIntoView({ block: 'nearest' }); pendingFocus.current = false; }
  });
  return <div ref={parent} className={`calendar-agenda ${embedded ? 'calendar-agenda-embedded' : 'calendar-panel'}`}
    aria-label={t.agenda} aria-describedby={helpId} data-testid="agenda-list" data-start={startDate} data-end={until}
    onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing ||
        !(event.target instanceof Element) || !event.target.closest('[data-agenda-row]')) return;
      let next = activeRow;
      if (event.key === 'ArrowDown') next++;
      else if (event.key === 'ArrowUp') next--;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = rows.length - 1;
      else return;
      event.preventDefault();
      next = Math.max(0, Math.min(rows.length - 1, next));
      if (next === activeRow) return;
      pendingFocus.current = true;
      setFocusedRow(next);
      virtual.scrollToIndex(next, { align: 'auto' });
    }}>
    <p id={helpId} className="sr-only">{text.agendaKeys}</p>
    <div className="calendar-agenda-content">
      {!endDate && <p className="calendar-range-label">{startDate} — {until}</p>}
      {!rows.length && <p className="calendar-empty" role="status">{emptyMessage || text.rangeEmpty}</p>}
      <div className="relative" role="list" aria-label={t.agenda} style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map(item => {
          const row = rows[item.index];
          return <div key={item.key} data-index={item.index} ref={virtual.measureElement}
            role="listitem" aria-posinset={item.index + 1} aria-setsize={rows.length} data-agenda-row={item.index}
            onFocusCapture={() => setFocusedRow(item.index)}
            className="absolute left-0 w-full pb-2" style={{ transform: `translateY(${item.start}px)` }}>
            {row.occurrence ? <CalendarEventCard occurrence={row.occurrence} language={language} onSelectEvent={onSelectEvent} tabIndex={activeRow === item.index ? 0 : -1} /> :
              <button type="button" onClick={() => onSelectDay(row.date)} className="calendar-agenda-date"
                tabIndex={activeRow === item.index ? 0 : -1}
                aria-current={row.date === today ? 'date' : undefined}>
                {row.date === today ? `${t.today} · ` : ''}
                {new Date(`${row.date}T12:00:00`).toLocaleDateString(locale(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </button>}
          </div>;
        })}
      </div>
      {!endDate && <button type="button" className="calendar-button agenda-load-more"
        onClick={() => setRange({ start: startDate, length: length + 60 })}>{text.nextEvents}</button>}
    </div>
  </div>;
}
