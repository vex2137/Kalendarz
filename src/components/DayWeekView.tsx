import React from 'react';
import { CalendarEvent } from '../types';
import { GOOGLE_CALENDAR_COLORS, DAY_NAMES_SHORT_PL, MONTH_NAMES_PL } from '../utils/constants';

interface DayWeekViewProps {
  currentDate: Date;
  viewMode: 'day' | 'week';
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
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Calculate days for week view (7 days starting from Monday)
  const getWeekDays = (date: Date) => {
    const days: { dateObj: Date; dateStr: string; dayNumber: number; dayName: string; isToday: boolean }[] = [];
    const current = new Date(date);
    const dayOfWeek = current.getDay();
    const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Monday start
    current.setDate(current.getDate() + diff);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let dow = d.getDay() - 1;
      if (dow === -1) dow = 6;

      days.push({
        dateObj: d,
        dateStr,
        dayNumber: d.getDate(),
        dayName: DAY_NAMES_SHORT_PL[dow],
        isToday: dateStr === todayStr,
      });
    }
    return days;
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
      <div className="flex theme-border border-b bg-stone-500/5 pl-10 sm:pl-14 pr-1 sm:pr-2 py-2">
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

      {/* Hourly Grid Scrollable Body */}
      <div className="flex-1 overflow-y-auto relative divide-y divide-stone-500/10">
        {hours.map((hour) => {
          const hourLabel = `${String(hour).padStart(2, '0')}:00`;

          return (
            <div key={hour} className="flex min-h-[50px] sm:min-h-[56px] relative group hover:bg-stone-500/5">
              {/* Hour Label */}
              <div className="w-10 sm:w-14 shrink-0 text-right pr-1 sm:pr-2.5 -top-2 relative text-[10px] sm:text-[11px] font-medium theme-muted select-none">
                {hourLabel}
              </div>

              {/* Day Columns */}
              <div className={`grid flex-1 border-l theme-border ${viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} divide-x divide-stone-500/10 relative`}>
                {daysToRender.map((day) => {
                  // Find events starting in this hour
                  const dayHourEvents = events.filter((ev) => {
                    if (ev.startDate !== day.dateStr || ev.allDay || !ev.startTime) return false;
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
                            {ev.startTime && (
                              <div className="text-[9px] sm:text-[10px] opacity-90 truncate hidden sm:block">
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
