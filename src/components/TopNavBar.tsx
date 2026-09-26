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
  Layers
} from 'lucide-react';
import { CalendarViewMode } from '../types';
import { MONTH_NAMES_PL } from '../utils/constants';
import { PWAInstallButton } from './PWAInstallButton';

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
  onOpenBuildGuide: () => void;
  isAiEnabled: boolean;
  notificationPermission: NotificationPermission;
  onRequestNotification: () => void;
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
  onOpenBuildGuide,
  isAiEnabled,
}) => {
  const monthName = MONTH_NAMES_PL[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <header className="sticky top-0 z-30 theme-header theme-border border-b px-2 sm:px-4 py-2 safe-top transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left Section: Brand, Today, Nav Chevrons & Month/Year */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="hidden xl:block">
              <span className="font-bold theme-text tracking-tight text-base whitespace-nowrap">Kalendarz Offline</span>
            </div>
          </div>

          <div className="h-5 w-px theme-border border-r hidden sm:block shrink-0"></div>

          {/* Today Button - Vertically centered with matching height */}
          <button
            id="btn-nav-today"
            onClick={onNavigateToday}
            className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-semibold rounded-xl theme-border border theme-surface theme-text theme-hover hover:opacity-90 transition-colors shadow-2xs shrink-0 flex items-center justify-center"
            title="Przejdź do dzisiejszego dnia"
          >
            Dziś
          </button>

          {/* Navigation Chevrons - Centered segmented pill */}
          <div className="h-8 sm:h-9 flex items-center rounded-xl theme-border border theme-surface p-0.5 shadow-2xs shrink-0">
            <button
              id="btn-nav-prev"
              onClick={onNavigatePrev}
              className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors flex items-center justify-center"
              title="Poprzedni okres"
              aria-label="Poprzedni"
            >
              <ChevronLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="w-px h-3.5 theme-border border-r mx-0.5"></div>
            <button
              id="btn-nav-next"
              onClick={onNavigateNext}
              className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors flex items-center justify-center"
              title="Następny okres"
              aria-label="Następny"
            >
              <ChevronRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>

          {/* Current Month & Year */}
          <h2 className="h-8 sm:h-9 flex items-center text-xs sm:text-base md:text-lg font-bold theme-text whitespace-nowrap shrink-0 pl-1">
            {monthName} <span className="font-normal theme-muted text-[11px] sm:text-sm md:text-base ml-1">{year}</span>
          </h2>
        </div>

        {/* Right Section: View selector, AI Assistant, Sync, Search, Settings & Create */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* View Mode Selector - Desktop full tabs (lg+) */}
          <div className="hidden lg:flex h-8 sm:h-9 items-center theme-subtle p-0.5 rounded-xl theme-border border text-xs font-medium shrink-0">
            <button
              id="btn-view-year"
              onClick={() => onViewModeChange('year')}
              className={`h-7 sm:h-7.5 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'year' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Rok
            </button>
            <button
              id="btn-view-month"
              onClick={() => onViewModeChange('month')}
              className={`h-7 sm:h-7.5 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'month' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Miesiąc
            </button>
            <button
              id="btn-view-week"
              onClick={() => onViewModeChange('week')}
              className={`h-7 sm:h-7.5 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'week' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Tydzień
            </button>
            <button
              id="btn-view-day"
              onClick={() => onViewModeChange('day')}
              className={`h-7 sm:h-7.5 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'day' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Dzień
            </button>
            <button
              id="btn-view-agenda"
              onClick={() => onViewModeChange('agenda')}
              className={`h-7 sm:h-7.5 px-2.5 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'agenda' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Harmonogram
            </button>
          </div>

          {/* View Mode Selector - Compact selector for tablet/medium screens (sm to lg) */}
          <div className="hidden sm:flex lg:hidden h-8 sm:h-9 items-center theme-subtle rounded-xl theme-border border px-2 text-xs shrink-0">
            <select
              aria-label="Wybierz widok kalendarza"
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value as CalendarViewMode)}
              className="bg-transparent theme-text font-semibold outline-hidden cursor-pointer"
            >
              <option value="month" className="theme-surface theme-text">Miesiąc</option>
              <option value="week" className="theme-surface theme-text">Tydzień</option>
              <option value="day" className="theme-surface theme-text">Dzień</option>
              <option value="year" className="theme-surface theme-text">Rok</option>
              <option value="agenda" className="theme-surface theme-text">Harmonogram</option>
            </select>
          </div>

          {/* Assistant Button */}
          {isAiEnabled && (
            <button
              id="btn-open-ai-assistant"
              onClick={onOpenAiDrawer}
              className="h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-2.5 rounded-xl text-xs font-semibold transition-all border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              title="Lokalny Asystent Kalendarza (Offline NLP)"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="hidden xl:inline">Asystent</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            id="btn-open-sync"
            onClick={onOpenSync}
            className="h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/30 text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
            title="Synchronizacja PC ⇄ Telefon (Bez konta, Kod QR / Plik)"
          >
            <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            <span className="hidden xl:inline">Synchronizuj</span>
          </button>

          {/* Quick Search Button (Lupa) */}
          <button
            id="btn-open-search"
            onClick={onOpenSearch}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl theme-muted hover:theme-text theme-hover flex items-center justify-center transition-colors border border-transparent hover:theme-border shrink-0"
            title="Szukaj wydarzeń (Ctrl+F)"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl theme-muted hover:theme-text theme-hover flex items-center justify-center transition-colors border border-transparent hover:theme-border shrink-0"
            title="Ustawienia, Święta, Motywy, PIN i Kopia"
          >
            <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* PWA Install Button (Desktop only) */}
          <div className="hidden sm:flex items-center shrink-0">
            <PWAInstallButton />
          </div>

          {/* Build Guide Button */}
          <button
            id="btn-open-build-guide"
            onClick={onOpenBuildGuide}
            className="hidden 2xl:flex h-8 sm:h-9 items-center justify-center gap-1.5 px-2.5 rounded-xl theme-subtle theme-hover theme-text theme-border border text-xs font-semibold shadow-2xs shrink-0"
            title="Instrukcje i skrypty budowy na APK, Linux i Windows"
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Buduj / APK</span>
          </button>

          {/* Create Button */}
          <button
            id="btn-create-event-top"
            onClick={onOpenCreateModal}
            className="hidden sm:flex h-8 sm:h-9 items-center justify-center gap-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Utwórz</span>
          </button>
        </div>
      </div>
    </header>
  );
};
