import React from 'react';
import { CalendarEvent, CalendarViewMode } from '../types';
import { DAY_NAMES_SHORT_PL, GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { isEventOccurringOnDate } from '../utils/recurrence';

interface DayWeekViewProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateAtTime: (dateStr: string, hour: number) => void;
}

export const DayWeekView: React.FC<DayWeekViewProps> = ({
  currentDate,
  viewMode,
  events,
  onSelectEvent,
  onCreateAtTime,
}) => {
  // Hours from 0 to 23
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Helper to calculate days for the current week (Mon-Sun)
  const getWeekDays = (baseDate: Date) => {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));

    const week: { dateObj: Date; dateStr: string; dayNumber: number; dayName: string; isToday: boolean }[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      let dow = current.getDay() - 1;
      if (dow === -1) dow = 6;

      week.push({
        dateObj: current,
        dateStr,
        dayNumber: current.getDate(),
        dayName: DAY_NAMES_SHORT_PL[dow],
        isToday: dateStr === todayStr,
      });
    }
    return week;
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHourMinutes = now.getHours() * 60 + now.getMinutes();

  let daysToRender: { dateObj: Date; dateStr: string; dayNumber: number; dayName: string; isToday: boolean }[] = [];

  if (viewMode === 'day') {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    let dow = currentDate.getDay() - 1;
    if (dow === -1) dow = 6;
    daysToRender = [{
      dateObj: currentDate,
      dateStr,
      dayNumber: currentDate.getDate(),
      dayName: DAY_NAMES_SHORT_PL[dow],
      isToday: dateStr === todayStr,
    }];
  } else {
    daysToRender = getWeekDays(currentDate);
  }

  // Calculate top & height percentage for an event in an hour block
  const getEventPosition = (startTime?: string, endTime?: string) => {
    if (!startTime) return { topPercent: 0, heightPercent: 100 };
    const [startH, startM] = startTime.split(':').map(Number);
    let durationMinutes = 60;

    if (endTime) {
      const [endH, endM] = endTime.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      if (endTotal > startTotal) {
        durationMinutes = endTotal - startTotal;
      }
    }

    const topPercent = (startM / 60) * 100;
    const heightPercent = (durationMinutes / 60) * 100;
    return { topPercent, heightPercent: Math.max(heightPercent, 25) };
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100dvh-130px)] sm:h-[calc(100vh-80px)] theme-surface theme-border border rounded-2xl overflow-hidden shadow-2xs transition-colors duration-200">
      {/* Top Days Header */}
      <div className="flex theme-border border-b bg-stone-500/5 pl-12 sm:pl-16 pr-1 sm:pr-2 py-2 shrink-0">
        <div className={`grid w-full ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} text-center`}>
          {daysToRender.map((day) => (
            <div key={day.dateStr} className="flex flex-col items-center">
              <span className="text-[10px] sm:text-[11px] font-semibold theme-muted uppercase">{day.dayName}</span>
              <span
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] sm:text-xs font-bold flex items-center justify-center mt-0.5 ${
                  day.isToday ? 'bg-blue-600 text-white shadow-xs' : 'theme-text'
                }`}
              >
                {day.dayNumber}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Grid Scrollable Body - with proper top/bottom space for full 00:00 - 23:00 visibility */}
      <div className="flex-1 overflow-y-auto relative divide-y divide-stone-500/10 pt-3 pb-8">
        {hours.map((hour) => {
          const hourLabel = `${String(hour).padStart(2, '0')}:00`;

          return (
            <div key={hour} className="flex min-h-[52px] sm:min-h-[56px] relative group hover:bg-stone-500/5">
              {/* Hour Label - Fully visible with generous spacing */}
              <div className="w-12 sm:w-16 shrink-0 text-right pr-2 sm:pr-3 pt-1 text-[11px] sm:text-xs font-medium theme-muted select-none">
                {hourLabel}
              </div>

              {/* Day Columns */}
              <div className={`grid flex-1 border-l theme-border ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} divide-x divide-stone-500/10 relative`}>
                {daysToRender.map((day) => {
                  // Find events occurring on this date and starting in this hour
                  const dayHourEvents = events.filter((ev) => {
                    if (!isEventOccurringOnDate(ev, day.dateStr) || ev.allDay || !ev.startTime) return false;
                    const [h] = ev.startTime.split(':').map(Number);
                    return h === hour;
                  });

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => onCreateAtTime(day.dateStr, hour)}
                      className="relative h-full cursor-pointer hover:bg-blue-50/30 transition-colors"
                    >
                      {/* Current Time Red Line */}
                      {day.isToday && hour === Math.floor(currentHourMinutes / 60) && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                          style={{ top: `${((currentHourMinutes % 60) / 60) * 100}%` }}
                        >
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-600 -ml-1"></div>
                          <div className="h-0.5 w-full bg-red-500"></div>
                        </div>
                      )}

                      {/* Events in this hour */}
                      {dayHourEvents.map((ev) => {
                        const colorDef = GOOGLE_CALENDAR_COLORS[ev.color] || GOOGLE_CALENDAR_COLORS.peacock;
                        const { topPercent, heightPercent } = getEventPosition(ev.startTime, ev.endTime);

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvent(ev);
                            }}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                            }}
                            className={`absolute left-0.5 right-0.5 z-10 rounded-md p-0.5 sm:p-1 shadow-xs cursor-pointer overflow-hidden text-[10px] sm:text-[11px] leading-tight ${colorDef.bg} ${colorDef.text}`}
                            title={`${ev.title} (${ev.startTime} - ${ev.endTime})`}
                          >
                            <div className="font-semibold truncate">{ev.title}</div>
                            {ev.endTime && (
                              <div className="opacity-80 text-[9px] truncate">
                                {ev.startTime} - {ev.endTime}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
