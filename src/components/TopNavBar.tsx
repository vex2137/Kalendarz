import React from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Settings as SettingsIcon,
  ArrowLeftRight,
  Search,
  Download
} from 'lucide-react';
import { CalendarViewMode } from '../types';
import { MONTH_NAMES, getTranslation, AppLanguage } from '../utils/i18n';

interface TopNavBarProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onOpenCreateModal: () => void;
  onOpenAiDrawer: () => void;
  onOpenSettings: () => void;
  onOpenSync: () => void;
  onOpenSearch: () => void;
  onOpenDownload?: () => void;
  isAiEnabled: boolean;
  language?: AppLanguage;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  onOpenCreateModal,
  onOpenAiDrawer,
  onOpenSettings,
  onOpenSync,
  onOpenSearch,
  onOpenDownload,
  isAiEnabled,
  language = 'pl',
}) => {
  const t = getTranslation(language);
  const monthName = MONTH_NAMES[language]?.[currentDate.getMonth()] || MONTH_NAMES.pl[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <header className="sticky top-0 z-30 theme-header theme-border border-b px-2.5 sm:px-4 pt-2.5 sm:pt-2.5 pb-2 safe-top transition-colors duration-200 w-full max-w-full overflow-hidden shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 w-full">
        {/* Left Section: Nav Chevrons, Today & Month/Year */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 min-w-0">
          {/* Brand Logo & Name (Desktop wide only) */}
          <div className="hidden 2xl:flex items-center gap-2 shrink-0 mr-1">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <span className="font-bold theme-text tracking-tight text-sm whitespace-nowrap">{t.appName}</span>
          </div>

          {/* Today Button */}
          <button
            id="btn-nav-today"
            onClick={onNavigateToday}
            className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-xl theme-border border theme-surface theme-text theme-hover hover:opacity-90 transition-colors shadow-2xs shrink-0 flex items-center justify-center"
            title={t.today}
          >
            {t.today}
          </button>

          {/* Navigation Chevrons */}
          <div className="h-8 flex items-center rounded-xl theme-border border theme-surface p-0.5 shadow-2xs shrink-0">
            <button
              id="btn-nav-prev"
              onClick={onNavigatePrev}
              className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg theme-muted hover:theme-text theme-hover transition-colors flex items-center justify-center"
              aria-label="Poprzedni"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-3.5 theme-border border-r mx-0.5"></div>
            <button
              id="btn-nav-next"
              onClick={onNavigateNext}
              className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg theme-muted hover:theme-text theme-hover transition-colors flex items-center justify-center"
              aria-label="Następny"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Month & Year - NEVER TRUNCATED (shrink-0) */}
          <h2 className="h-8 flex items-center text-xs sm:text-base md:text-lg font-bold theme-text whitespace-nowrap shrink-0 pl-1">
            <span>{monthName}</span>
            <span className="font-normal theme-muted text-[11px] sm:text-sm ml-1.5">{year}</span>
          </h2>
        </div>

        {/* Right Section: View selector (desktop), AI, Sync, Search, Settings & Create */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* View Mode Selector - Desktop full tabs (xl+) */}
          <div className="hidden xl:flex h-8 items-center theme-subtle p-0.5 rounded-xl theme-border border text-xs font-medium shrink-0">
            <button
              id="btn-view-year"
              onClick={() => onViewModeChange('year')}
              className={`h-7 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'year' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              {t.year}
            </button>
            <button
              id="btn-view-month"
              onClick={() => onViewModeChange('month')}
              className={`h-7 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'month' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              {t.month}
            </button>
            <button
              id="btn-view-week"
              onClick={() => onViewModeChange('week')}
              className={`h-7 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'week' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              {t.week}
            </button>
            <button
              id="btn-view-day"
              onClick={() => onViewModeChange('day')}
              className={`h-7 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'day' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              {t.day}
            </button>
            <button
              id="btn-view-agenda"
              onClick={() => onViewModeChange('agenda')}
              className={`h-7 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'agenda' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              {t.agenda}
            </button>
          </div>

          {/* View Mode Selector - Compact selector for tablet & medium screens (sm to xl) */}
          <div className="hidden sm:flex xl:hidden h-8 items-center theme-subtle rounded-xl theme-border border px-2 text-xs shrink-0">
            <select
              aria-label="Wybierz widok kalendarza"
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value as CalendarViewMode)}
              className="bg-transparent theme-text font-semibold outline-hidden cursor-pointer text-xs"
            >
              <option value="month" className="theme-surface theme-text">{t.month}</option>
              <option value="week" className="theme-surface theme-text">{t.week}</option>
              <option value="day" className="theme-surface theme-text">{t.day}</option>
              <option value="year" className="theme-surface theme-text">{t.year}</option>
              <option value="agenda" className="theme-surface theme-text">{t.agenda}</option>
            </select>
          </div>

          {/* Quick Search Button */}
          <button
            id="btn-open-search"
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-xl theme-muted hover:theme-text theme-hover flex items-center justify-center transition-colors border border-transparent hover:theme-border shrink-0"
            title={t.search}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Assistant Button */}
          {isAiEnabled && (
            <button
              id="btn-open-ai-assistant"
              onClick={onOpenAiDrawer}
              className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-xl text-xs font-semibold transition-all border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              title={t.aiAssistantTitle}
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="hidden 2xl:inline">{t.assistant}</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            id="btn-open-sync"
            onClick={onOpenSync}
            className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/30 text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
            title={t.sync}
          >
            <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            <span className="hidden 2xl:inline">{t.sync}</span>
          </button>

          {/* Download Desktop App Button */}
          {onOpenDownload && (
            <button
              id="btn-open-download"
              onClick={onOpenDownload}
              className="h-8 px-2 sm:px-2.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors border border-blue-500/30 text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
              title="Pobierz aplikację (.exe / .AppImage)"
            >
              <Download className="w-4 h-4 text-blue-500" />
              <span className="hidden xl:inline">Pobierz app</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-xl theme-muted hover:theme-text theme-hover flex items-center justify-center transition-colors border border-transparent hover:theme-border shrink-0"
            title={t.settings}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Create Button (Desktop) */}
          <button
            id="btn-create-event-top"
            onClick={onOpenCreateModal}
            className="hidden sm:flex h-8 items-center justify-center gap-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">{t.create}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
