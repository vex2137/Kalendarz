import React, { useMemo } from 'react';
import { MONTH_NAMES, DAY_NAMES_SHORT, type AppLanguage } from '../utils/i18n';
import { MONTH_NAMES_PL, DAY_NAMES_SHORT_PL } from '../utils/constants';
import { CalendarEvent } from '../types';
import { eventDatePresence } from '../utils/recurrence';

interface YearViewProps {
  currentDate: Date;
  language?: AppLanguage;
  now?: Date;
  events: CalendarEvent[];
  onSelectMonth: (monthIndex: number) => void;
  onSelectDay: (dateStr: string) => void;
}

export const YearView: React.FC<YearViewProps> = ({
  currentDate,
  events,
  onSelectMonth,
  onSelectDay,
  language = 'pl',
  now = new Date(),
}) => {
  const currentYear = currentDate.getFullYear();
  const presence = useMemo(
    () =>
      eventDatePresence(events, `${currentYear}-01-01`, `${currentYear}-12-31`),
    [events, currentYear],
  );
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {MONTH_NAMES[language].map((mName, mIdx) => {
          const firstDay = new Date(currentYear, mIdx, 1);
          let startDow = firstDay.getDay() - 1;
          if (startDow === -1) startDow = 6;
          const daysInMonth = new Date(currentYear, mIdx + 1, 0).getDate();

          const days: (number | null)[] = [];
          for (let i = 0; i < startDow; i++) days.push(null);
          for (let d = 1; d <= daysInMonth; d++) days.push(d);

          return (
            <div
              key={mName}
              onClick={() => onSelectMonth(mIdx)}
              className="theme-surface theme-border border rounded-2xl p-3 shadow-2xs hover:border-blue-500/50 transition-all cursor-pointer group w-full"
            >
              <h3 className="text-sm font-bold theme-text mb-2 flex items-center justify-between group-hover:text-blue-500 transition-colors">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMonth(mIdx);
                  }}
                >
                  {mName}
                </button>
                <span className="text-xs font-normal theme-muted">
                  {currentYear}
                </span>
              </h3>

              <div className="grid grid-cols-7 text-center text-[10px] font-semibold theme-muted mb-1">
                {DAY_NAMES_SHORT[language].map((d, i) => (
                  <span key={d} className={i >= 5 ? 'opacity-60' : ''}>
                    {d[0]}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {days.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-6" />;
                  }

                  const dateStr = `${currentYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const hasEvent = presence.has(dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay(dateStr);
                      }}
                      className={`h-6 w-6 mx-auto rounded-full flex flex-col items-center justify-center text-[11px] relative transition-all ${
                        isToday
                          ? 'theme-accent-fill bg-blue-600 text-white font-bold shadow-xs'
                          : 'theme-text hover:bg-stone-500/10'
                      }`}
                    >
                      <span>{day}</span>
                      {hasEvent && !isToday && (
                        <span className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-0.5" />
                      )}
                    </button>
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
