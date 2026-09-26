import React from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Settings as SettingsIcon,
  Bell,
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
  notificationPermission,
  onRequestNotification,
}) => {
  const monthName = MONTH_NAMES_PL[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <header className="sticky top-0 z-30 theme-header theme-border border-b px-3 py-2.5 sm:px-5 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left Section: Brand & Month Navigation */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold theme-text tracking-tight text-base">Kalendarz Offline</span>
            </div>
          </div>

          <div className="h-5 w-px theme-border border-r hidden sm:block"></div>

          {/* Today Button */}
          <button
            id="btn-nav-today"
            onClick={onNavigateToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl theme-border border theme-surface theme-text theme-hover hover:opacity-90 transition-colors shadow-2xs"
          >
            Dzisiaj
          </button>

          {/* Chevrons */}
          <div className="flex items-center gap-0.5">
            <button
              id="btn-nav-prev"
              onClick={onNavigatePrev}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title="Poprzedni"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              id="btn-nav-next"
              onClick={onNavigateNext}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title="Następny"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Current Month & Year */}
          <h2 className="text-base sm:text-lg font-bold theme-text whitespace-nowrap pl-1">
            {monthName} <span className="font-normal theme-muted">{year}</span>
          </h2>
        </div>

        {/* Center / Right Section: Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Search Button */}
          <button
            id="btn-open-search"
            onClick={onOpenSearch}
            className="p-2 rounded-xl theme-muted hover:theme-text theme-hover transition-colors border border-transparent hover:theme-border"
            title="Szukaj wydarzeń (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Notification permission prompt if not yet granted */}
          {notificationPermission !== 'granted' && (
            <button
              id="btn-request-notifications"
              onClick={onRequestNotification}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              title="Włącz powiadomienia na urządzeniu"
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>Alerty</span>
            </button>
          )}

          {/* View Mode Selector */}
          <div className="hidden md:flex theme-subtle p-0.5 rounded-xl theme-border border text-xs font-medium">
            <button
              id="btn-view-month"
              onClick={() => onViewModeChange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
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
              className={`px-3 py-1.5 rounded-lg transition-all ${
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
              className={`px-3 py-1.5 rounded-lg transition-all ${
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
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'agenda' 
                  ? 'theme-surface theme-text shadow-xs font-bold' 
                  : 'theme-muted hover:theme-text'
              }`}
            >
              Harmonogram
            </button>
          </div>

          {/* Assistant Button */}
          {isAiEnabled && (
            <button
              id="btn-open-ai-assistant"
              onClick={onOpenAiDrawer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 shadow-xs"
              title="Lokalny Asystent Kalendarza (Offline NLP)"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Asystent</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            id="btn-open-sync"
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors border border-indigo-500/30 text-xs font-semibold shadow-2xs"
            title="Synchronizacja PC ⇄ Telefon (Bez konta, Kod QR / Plik)"
          >
            <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Synchronizuj</span>
          </button>

          {/* Build Guide Button */}
          <button
            id="btn-open-build-guide"
            onClick={onOpenBuildGuide}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl theme-subtle theme-hover theme-text theme-border border text-xs font-semibold shadow-2xs"
            title="Instrukcje i skrypty budowy na APK, Linux i Windows"
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Buduj / APK</span>
          </button>

          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-xl theme-muted hover:theme-text theme-hover transition-colors border border-transparent hover:theme-border"
            title="Ustawienia, Święta, Motywy, PIN i Kopia"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Create Button */}
          <button
            id="btn-create-event-top"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Utwórz</span>
          </button>
        </div>
      </div>

      {/* Mobile view selector row */}
      <div className="flex md:hidden mt-2 pt-2 theme-border border-t items-center justify-between">
        <div className="flex theme-subtle p-0.5 rounded-xl theme-border border text-xs font-medium w-full justify-between">
          <button
            onClick={() => onViewModeChange('month')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
              viewMode === 'month' ? 'theme-surface theme-text shadow-xs font-bold' : 'theme-muted'
            }`}
          >
            Miesiąc
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
              viewMode === 'week' ? 'theme-surface theme-text shadow-xs font-bold' : 'theme-muted'
            }`}
          >
            Tydzień
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
              viewMode === 'day' ? 'theme-surface theme-text shadow-xs font-bold' : 'theme-muted'
            }`}
          >
            Dzień
          </button>
          <button
            onClick={() => onViewModeChange('agenda')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
              viewMode === 'agenda' ? 'theme-surface theme-text shadow-xs font-bold' : 'theme-muted'
            }`}
          >
            Plan
          </button>
        </div>
      </div>
    </header>
  );
};
