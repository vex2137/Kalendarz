import React from 'react';
import { 
  Calendar as MonthIcon, 
  CalendarRange, 
  CalendarDays, 
  ListOrdered,
  CalendarCheck
} from 'lucide-react';
import { CalendarViewMode } from '../types';

interface BottomNavMobileProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  todayDayNumber: number;
  onNavigateToday: () => void;
}

export const BottomNavMobile: React.FC<BottomNavMobileProps> = ({
  viewMode,
  onViewModeChange,
  todayDayNumber,
  onNavigateToday,
}) => {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 theme-header theme-border border-t safe-bottom px-1 py-1.5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Rok */}
        <button
          onClick={() => onViewModeChange('year')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            viewMode === 'year'
              ? 'text-blue-500 font-bold scale-105'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <CalendarCheck className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">Rok</span>
        </button>

        {/* Miesiąc */}
        <button
          onClick={() => onViewModeChange('month')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            viewMode === 'month'
              ? 'text-blue-500 font-bold scale-105'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <MonthIcon className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">Miesiąc</span>
        </button>

        {/* Tydzień */}
        <button
          onClick={() => onViewModeChange('week')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            viewMode === 'week'
              ? 'text-blue-500 font-bold scale-105'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <CalendarRange className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">Tydzień</span>
        </button>

        {/* Dzień */}
        <button
          onClick={() => onViewModeChange('day')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            viewMode === 'day'
              ? 'text-blue-500 font-bold scale-105'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <div className="relative flex items-center justify-center w-6 h-6 mb-1">
            <CalendarDays className="w-6 h-6" />
            <span className="absolute text-[9px] font-bold top-[6px]">{todayDayNumber}</span>
          </div>
          <span className="text-[11px] font-medium tracking-tight">Dzień</span>
        </button>

        {/* Plan / Agenda */}
        <button
          onClick={() => onViewModeChange('agenda')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            viewMode === 'agenda'
              ? 'text-blue-500 font-bold scale-105'
              : 'theme-muted hover:theme-text'
          }`}
        >
          <ListOrdered className="w-6 h-6 mb-1" />
          <span className="text-[11px] font-medium tracking-tight">Plan</span>
        </button>
      </div>
    </nav>
  );
};
