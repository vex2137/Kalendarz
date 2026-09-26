import React from 'react';
import { CalendarEvent } from '../types';
import { GOOGLE_CALENDAR_COLORS, MONTH_NAMES_PL, DAY_NAMES_FULL_PL } from '../utils/constants';
import { Clock, MapPin, Repeat, CalendarCheck2 } from 'lucide-react';
import { isEventOccurringOnDate, getRecurrenceLabel, formatISODate } from '../utils/recurrence';

interface AgendaViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (dateStr: string) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  events,
  onSelectEvent,
  onSelectDay,
}) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Generate date list for the next 60 days to expand recurring and regular events
  const groupedEvents: Record<string, CalendarEvent[]> = {};

  // For the next 60 days:
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateStr = formatISODate(d);

    const occurrences = events.filter((ev) => isEventOccurringOnDate(ev, dateStr));
    if (occurrences.length > 0) {
      // Sort events: all-day first, then by startTime
      const sorted = [...occurrences].sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      groupedEvents[dateStr] = sorted;
    }
  }

  const formatHeaderDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    let dayOfWeek = dateObj.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    const dayName = DAY_NAMES_FULL_PL[dayOfWeek];
    const monthName = MONTH_NAMES_PL[m - 1];

    let prefix = '';
    if (dateStr === todayStr) prefix = 'Dzisiaj • ';

    return {
      dayNumber: d,
      fullText: `${prefix}${dayName}, ${d} ${monthName} ${y}`,
      isToday: dateStr === todayStr,
    };
  };

  const dates = Object.keys(groupedEvents);

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-140px)] theme-surface rounded-2xl theme-border border shadow-2xs">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
          <CalendarCheck2 className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold theme-text">Brak nadchodzących wydarzeń</h3>
        <p className="text-xs theme-muted mt-1 max-w-xs">
          Wszystko gotowe! Możesz dodać nowe wydarzenie przyciskiem „Utwórz” lub poprosić lokalnego Asystenta AI.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 transition-colors duration-200">
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {dates.map((dateStr) => {
          const headerInfo = formatHeaderDate(dateStr);
          const dayEvents = groupedEvents[dateStr];

          return (
            <div key={dateStr} className="space-y-2">
              {/* Date Header Sticky Style */}
              <div 
                onClick={() => onSelectDay(dateStr)}
                className="flex items-center gap-2.5 py-1 px-2 cursor-pointer group"
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-105 ${
                    headerInfo.isToday
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-stone-500/20 theme-text'
                  }`}
                >
                  {headerInfo.dayNumber}
                </span>
                <span className={`text-sm font-semibold tracking-tight ${headerInfo.isToday ? 'text-blue-500 font-bold' : 'theme-text'}`}>
                  {headerInfo.fullText}
                </span>
              </div>

              {/* Event Cards */}
              <div className="space-y-2">
                {dayEvents.map((ev) => {
                  const colorDef = GOOGLE_CALENDAR_COLORS[ev.color] || GOOGLE_CALENDAR_COLORS.peacock;
                  const recurrenceLabel = getRecurrenceLabel(ev);

                  return (
                    <div
                      key={`${ev.id}-${dateStr}`}
                      id={`agenda-event-${ev.id}`}
                      onClick={() => onSelectEvent(ev)}
                      className="flex items-center gap-3 p-3.5 theme-surface rounded-xl theme-border border shadow-xs hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer group"
                    >
                      {/* Color Stripe / Pill */}
                      <div
                        className="w-1.5 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: colorDef.dot }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold theme-text group-hover:text-blue-500 transition-colors truncate">
                            {ev.title}
                          </h4>
                          {ev.recurrence && ev.recurrence !== 'NONE' && (
                            <span className="flex items-center text-[10px] theme-subtle theme-border border px-1.5 py-0.5 rounded-md text-blue-400">
                              <Repeat className="w-2.5 h-2.5 mr-1" />
                              {recurrenceLabel}
                            </span>
                          )}
                        </div>

                        {/* Details row: time & location */}
                        <div className="flex flex-wrap items-center gap-3 text-xs theme-muted mt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 opacity-70" />
                            <span>
                              {ev.allDay ? 'Cały dzień' : `${ev.startTime || ''} – ${ev.endTime || ''}`}
                            </span>
                          </div>

                          {ev.location && (
                            <div className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-xs theme-muted mt-1.5 line-clamp-1 opacity-80">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      {/* Reminders count chip */}
                      {ev.reminders && ev.reminders.length > 0 && (
                        <div className="text-[10px] font-medium px-2 py-1 bg-stone-500/10 theme-muted rounded-lg shrink-0">
                          {ev.reminders.length} {ev.reminders.length === 1 ? 'alert' : 'alerty'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
