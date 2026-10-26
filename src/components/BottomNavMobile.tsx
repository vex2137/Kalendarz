import { tr } from '../utils/i18n';
import React from 'react';
import { 
  Calendar as MonthIcon, 
  CalendarRange, 
  CalendarDays, 
  ListOrdered,
  CalendarCheck
} from 'lucide-react';
import { CalendarViewMode } from '../types';
import { getTranslation, AppLanguage } from '../utils/i18n';

interface BottomNavMobileProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  todayDayNumber: number;
  onNavigateToday: () => void;
  language?: AppLanguage;
}

export const BottomNavMobile: React.FC<BottomNavMobileProps> = ({
  viewMode,
  onViewModeChange,
  todayDayNumber,
  language = 'en',
}) => {
  const t = getTranslation(language);

  return (
    <nav aria-label={tr(language, 'Widoki kalendarza', 'Calendar views')} className="sm:hidden fixed bottom-0 left-0 right-0 z-30 theme-header theme-border border-t safe-bottom px-1 py-1.5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Rok */}
        <button
          aria-pressed={viewMode === 'year'}
          onClick={() => onViewModeChange('year')}
          className={`calendar-view-button min-h-11 flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            viewMode === 'year'
              ? 'font-bold'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <CalendarCheck className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">{t.year}</span>
        </button>

        {/* Miesiąc */}
        <button
          aria-pressed={viewMode === 'month'}
          onClick={() => onViewModeChange('month')}
          className={`calendar-view-button min-h-11 flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            viewMode === 'month'
              ? 'font-bold'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <MonthIcon className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">{t.month}</span>
        </button>

        {/* Tydzień */}
        <button
          aria-pressed={viewMode === 'week'}
          onClick={() => onViewModeChange('week')}
          className={`calendar-view-button min-h-11 flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            viewMode === 'week'
              ? 'font-bold'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <CalendarRange className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">{t.week}</span>
        </button>

        {/* Dzień */}
        <button
          aria-pressed={viewMode === 'day'}
          onClick={() => onViewModeChange('day')}
          className={`calendar-view-button min-h-11 flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            viewMode === 'day'
              ? 'font-bold'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <div className="relative flex items-center justify-center w-6 h-6 mb-1">
            <CalendarDays className="w-6 h-6" />
            <span className="absolute text-[9px] font-bold top-[6px]">{todayDayNumber}</span>
          </div>
          <span className="text-[11px] font-medium tracking-tight">{t.day}</span>
        </button>

        {/* Plan / Agenda */}
        <button
          aria-pressed={viewMode === 'agenda'}
          onClick={() => onViewModeChange('agenda')}
          className={`calendar-view-button min-h-11 flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            viewMode === 'agenda'
              ? 'font-bold'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <ListOrdered className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">{t.agenda}</span>
        </button>
      </div>
    </nav>
  );
};
