import React from 'react';
import { MONTH_NAMES_PL, DAY_NAMES_SHORT_PL, GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { CalendarEvent } from '../types';
import { isEventOccurringOnDate } from '../utils/recurrence';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectDay: (dateStr: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onSelectDay,
  onSelectEvent,
}) => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Determine current day string
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // First day of current month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  // Total days in current month
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Day of week for 1st of month: 0 (Sun) to 6 (Sat)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1; // Convert to Mon=0 ... Sun=6
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  // Days in previous month
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Build grid cells (6 rows x 7 cols = 42 cells)
  const calendarCells: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
  }[] = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthDate = new Date(currentYear, currentMonth - 1, day);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days (fill up to 42 cells)
  const remainingCells = 42 - calendarCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthDate = new Date(currentYear, currentMonth + 1, d);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return (
    <div className="flex flex-col flex-1 h-[calc(100dvh-130px)] sm:h-[calc(100vh-80px)] theme-surface rounded-2xl theme-border border overflow-hidden shadow-2xs transition-colors duration-200">
      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 theme-border border-b bg-stone-500/5 text-center py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold theme-muted">
        {DAY_NAMES_SHORT_PL.map((day, idx) => (
          <div key={day} className={idx >= 5 ? 'opacity-60' : ''}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 theme-border divide-x divide-stone-500/15">
        {calendarCells.map((cell, index) => {
          // Filter events matching this date (including recurring rules)
          const dayEvents = events.filter((ev) => isEventOccurringOnDate(ev, cell.dateStr));

          // Sort events: allDay first, then by startTime
          const sortedEvents = [...dayEvents].sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return (a.startTime || '').localeCompare(b.startTime || '');
          });

          return (
            <div
              key={`${cell.dateStr}-${index}`}
              id={`calendar-cell-${cell.dateStr}`}
              onClick={() => onSelectDay(cell.dateStr)}
              className={`flex flex-col p-1 sm:p-1.5 transition-colors cursor-pointer group border-b border-stone-500/15 overflow-hidden min-h-0 ${
                cell.isCurrentMonth ? 'theme-surface hover:bg-stone-500/5' : 'bg-stone-500/5 hover:bg-stone-500/10'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <span
                  className={`inline-flex items-center justify-center text-[11px] sm:text-xs font-medium rounded-full w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-105 ${
                    cell.isToday
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : cell.isCurrentMonth
                      ? 'theme-text'
                      : 'theme-muted opacity-50'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Event Count Dot on Mobile */}
                {sortedEvents.length > 0 && (
                  <span className="sm:hidden flex items-center justify-center text-[9px] font-bold px-1 rounded-full bg-blue-500/20 text-blue-400">
                    {sortedEvents.length}
                  </span>
                )}
              </div>

              {/* Event Chips (Desktop & Tablets) */}
              <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                {sortedEvents.slice(0, 3).map((ev) => {
                  const colorDef = GOOGLE_CALENDAR_COLORS[ev.color] || GOOGLE_CALENDAR_COLORS.peacock;

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded-md text-[11px] font-medium truncate transition-opacity hover:opacity-85 cursor-pointer flex items-center gap-1 shadow-2xs ${colorDef.bg} ${colorDef.text}`}
                      title={`${ev.title} (${ev.allDay ? 'Cały dzień' : ev.startTime || ''})`}
                    >
                      {!ev.allDay && ev.startTime && (
                        <span className="opacity-75 font-mono text-[9px] shrink-0">
                          {ev.startTime}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  );
                })}

                {/* More events overflow indicator */}
                {sortedEvents.length > 3 && (
                  <span className="text-[10px] font-medium theme-muted pl-1">
                    +{sortedEvents.length - 3} więcej
                  </span>
                )}
              </div>

              {/* Mobile Event Dots indicator (Colored circles) */}
              <div className="sm:hidden flex flex-wrap gap-1 mt-auto pb-0.5 max-h-3 overflow-hidden">
                {sortedEvents.slice(0, 4).map((ev) => {
                  const colorDef = GOOGLE_CALENDAR_COLORS[ev.color] || GOOGLE_CALENDAR_COLORS.peacock;
                  return (
                    <span
                      key={ev.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colorDef.dot }}
                    />
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
