import React from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Settings as SettingsIcon,
  Search,
  Bell,
  Check
} from 'lucide-react';
import { CalendarViewMode } from '../types';
import { MONTH_NAMES_PL } from '../utils/constants';
import { PrivacyBadge } from './PrivacyBadge';
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
  isAiEnabled,
  notificationPermission,
  onRequestNotification,
}) => {
  const monthName = MONTH_NAMES_PL[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-3 py-2.5 sm:px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left Section: Brand & Month Navigation */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="hidden md:block">
              <span className="font-semibold text-stone-900 tracking-tight text-base">Kalendarz</span>
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200">AI Offline</span>
            </div>
          </div>

          <div className="h-5 w-px bg-stone-200 hidden sm:block"></div>

          {/* Today Button */}
          <button
            id="btn-nav-today"
            onClick={onNavigateToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            Dzisiaj
          </button>

          {/* Chevrons */}
          <div className="flex items-center gap-0.5">
            <button
              id="btn-nav-prev"
              onClick={onNavigatePrev}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              title="Poprzedni"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              id="btn-nav-next"
              onClick={onNavigateNext}
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              title="Następny"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Current Month & Year */}
          <h2 className="text-base sm:text-lg font-semibold text-stone-900 whitespace-nowrap">
            {monthName} <span className="font-normal text-stone-500">{year}</span>
          </h2>
        </div>

        {/* Center / Right Section: Controls */}
        <div className="flex items-center gap-2">
          {/* Privacy badge */}
          <PrivacyBadge />

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Notification permission prompt if not yet granted */}
          {notificationPermission !== 'granted' && (
            <button
              id="btn-request-notifications"
              onClick={onRequestNotification}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              title="Włącz powiadomienia push w przeglądarce / na telefonie"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Włącz alerty</span>
            </button>
          )}

          {/* View Mode Selector */}
          <div className="hidden sm:flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs font-medium">
            <button
              id="btn-view-month"
              onClick={() => onViewModeChange('month')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'month' 
                  ? 'bg-white text-stone-900 shadow-xs font-semibold' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Miesiąc
            </button>
            <button
              id="btn-view-week"
              onClick={() => onViewModeChange('week')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'week' 
                  ? 'bg-white text-stone-900 shadow-xs font-semibold' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Tydzień
            </button>
            <button
              id="btn-view-day"
              onClick={() => onViewModeChange('day')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'day' 
                  ? 'bg-white text-stone-900 shadow-xs font-semibold' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Dzień
            </button>
            <button
              id="btn-view-agenda"
              onClick={() => onViewModeChange('agenda')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'agenda' 
                  ? 'bg-white text-stone-900 shadow-xs font-semibold' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Harmonogram
            </button>
          </div>

          {/* AI Assistant Button */}
          <button
            id="btn-open-ai-assistant"
            onClick={onOpenAiDrawer}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isAiEnabled 
                ? 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100 shadow-xs' 
                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
            }`}
            title="Lokalny Asystent AI (Gemma 2 2B / NLP Offline)"
          >
            <Sparkles className={`w-4 h-4 ${isAiEnabled ? 'text-violet-600 animate-pulse' : 'text-stone-400'}`} />
            <span className="hidden md:inline">Asystent AI</span>
            {isAiEnabled && (
              <span className="hidden lg:inline text-[10px] uppercase font-bold tracking-wider px-1 rounded bg-violet-200 text-violet-900">
                Gemma 2B
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200"
            title="Ustawienia, PIN i Eksport"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Create Button */}
          <button
            id="btn-create-event-top"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Utwórz</span>
          </button>
        </div>
      </div>

      {/* Mobile view selector row */}
      <div className="flex sm:hidden mt-2 pt-2 border-t border-stone-100 items-center justify-between">
        <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs font-medium w-full justify-between">
          <button
            onClick={() => onViewModeChange('month')}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              viewMode === 'month' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Miesiąc
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              viewMode === 'week' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Tydzień
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              viewMode === 'day' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Dzień
          </button>
          <button
            onClick={() => onViewModeChange('agenda')}
            className={`flex-1 py-1 rounded-md text-center transition-all ${
              viewMode === 'agenda' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-600'
            }`}
          >
            Plan
          </button>
        </div>
      </div>
    </header>
  );
};
