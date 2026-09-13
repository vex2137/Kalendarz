import React from 'react';
import { CalendarEvent } from '../types';
import { DAY_NAMES_SHORT_PL, GOOGLE_CALENDAR_COLORS } from '../utils/constants';

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
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of current month
  const firstDayOfMonth = new Date(year, month, 1);
  // Last day of current month
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Sunday in JS, convert to 0 = Monday)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Build grid days (42 cells: 6 weeks)
  const calendarCells: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
  }[] = [];

  // Previous month trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevM = month === 0 ? 12 : month;
    const prevY = month === 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days (fill up to 35 or 42)
  const remainingCells = 42 - calendarCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    const nextM = month === 11 ? 1 : month + 2;
    const nextY = month === 11 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Map events by dateStr
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    if (!eventsByDate[ev.startDate]) {
      eventsByDate[ev.startDate] = [];
    }
    eventsByDate[ev.startDate].push(ev);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-115px)] sm:h-[calc(100vh-80px)] bg-white">
      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center py-2 text-xs font-semibold text-stone-600">
        {DAY_NAMES_SHORT_PL.map((day, idx) => (
          <div key={day} className={idx >= 5 ? 'text-stone-400' : ''}>
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 border-b border-stone-200 divide-x divide-stone-200">
        {calendarCells.map((cell, index) => {
          const dayEvents = eventsByDate[cell.dateStr] || [];
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
              className={`flex flex-col p-1 sm:p-1.5 transition-colors cursor-pointer group border-b border-stone-200 overflow-hidden ${
                cell.isCurrentMonth ? 'bg-white hover:bg-stone-50/70' : 'bg-stone-50/40 hover:bg-stone-100/50'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center text-xs font-medium rounded-full w-6 h-6 transition-transform group-hover:scale-105 ${
                    cell.isToday
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : cell.isCurrentMonth
                      ? 'text-stone-800'
                      : 'text-stone-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Event count pill on mobile if crowded */}
                {sortedEvents.length > 0 && (
                  <span className="sm:hidden text-[10px] font-medium text-stone-500 bg-stone-100 px-1 rounded-sm">
                    {sortedEvents.length}
                  </span>
                )}
              </div>

              {/* Event chips container */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[85px] sm:max-h-[105px] pr-0.5">
                {sortedEvents.slice(0, 3).map((ev) => {
                  const colorDef = GOOGLE_CALENDAR_COLORS[ev.color] || GOOGLE_CALENDAR_COLORS.peacock;
                  return (
                    <button
                      key={ev.id}
                      id={`event-chip-${ev.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      className={`text-left text-[11px] leading-tight px-1.5 py-0.5 rounded-sm font-medium truncate flex items-center gap-1 transition-opacity hover:opacity-90 ${colorDef.bg} ${colorDef.text}`}
                      title={`${ev.title} ${ev.startTime ? `(${ev.startTime})` : ''}`}
                    >
                      {!ev.allDay && (
                        <span className="font-semibold text-[10px] opacity-90 shrink-0">
                          {ev.startTime}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  );
                })}

                {sortedEvents.length > 3 && (
                  <div className="text-[10px] font-semibold text-stone-500 hover:text-stone-800 pl-1">
                    +{sortedEvents.length - 3} więcej
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
