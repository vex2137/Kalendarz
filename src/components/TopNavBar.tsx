import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Settings,
  ArrowLeftRight,
  Search,
  Download,
} from 'lucide-react';
import type { CalendarViewMode } from '../types';
import { MONTH_NAMES, getTranslation, type AppLanguage } from '../utils/i18n';
interface Props {
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
export function TopNavBar(p: Props) {
  const t = getTranslation(p.language || 'en');
  const modes = [
    ['year', t.year],
    ['month', t.month],
    ['week', t.week],
    ['day', t.day],
    ['agenda', t.agenda],
  ] as const;
  return (
    <header className="shrink-0 sticky top-0 z-30 theme-header theme-border border-b px-2 sm:px-4 safe-top pb-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 min-w-0">
          <button
            id="btn-nav-today"
            onClick={p.onNavigateToday}
            className="min-h-10 px-2 rounded-lg theme-border border text-xs font-semibold"
          >
            {t.today}
          </button>
          <button
            id="btn-nav-prev"
            aria-label={p.language === 'en' ? 'Previous' : 'Poprzedni'}
            onClick={p.onNavigatePrev}
            className="w-8 h-10 flex items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            id="btn-nav-next"
            aria-label={p.language === 'en' ? 'Next' : 'Następny'}
            onClick={p.onNavigateNext}
            className="w-8 h-10 flex items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold" aria-label={t.appName}>{t.appName}</span>
          <h2 className="text-sm sm:text-lg font-semibold whitespace-nowrap">
            {MONTH_NAMES[p.language || 'en'][p.currentDate.getMonth()]}{' '}
            <span className="theme-muted font-normal">
              {p.currentDate.getFullYear()}
            </span>
          </h2>
        </div>
        <div className="flex items-center flex-wrap gap-1">
          {[
            ['btn-open-search', t.search, p.onOpenSearch, Search],
            ...(p.isAiEnabled
              ? [
                  [
                    'btn-open-ai-assistant',
                    t.assistant,
                    p.onOpenAiDrawer,
                    Sparkles,
                  ],
                ]
              : []),
            ['btn-open-sync', t.sync, p.onOpenSync, ArrowLeftRight],
            ['btn-open-settings', t.settings, p.onOpenSettings, Settings],
            ...(p.onOpenDownload
              ? [
                  [
                    'btn-open-download',
                    p.language === 'en' ? 'Download app' : 'Pobierz aplikację',
                    p.onOpenDownload,
                    Download,
                  ],
                ]
              : []),
          ].map(([id, label, click, Icon]) => {
            const Component = Icon as typeof Search;
            return (
              <button
                key={String(id)}
                id={String(id)}
                aria-label={String(label)}
                title={String(label)}
                onClick={click as () => void}
                className="w-10 h-10 rounded-lg theme-hover flex items-center justify-center"
              >
                <Component size={18} />
              </button>
            );
          })}
          <button
            id="btn-create-event-top"
            onClick={p.onOpenCreateModal}
            className="hidden sm:flex items-center gap-1 min-h-10 px-3 bg-blue-600 text-white rounded-lg text-xs"
          >
            <Plus size={18} />
            {t.create}
          </button>
        </div>
      </div>
      <div
        className="grid grid-cols-5 gap-1 max-w-2xl mx-auto mt-1 theme-subtle p-1 rounded-xl"
        aria-label={
          p.language === 'en' ? 'Calendar views' : 'Widoki kalendarza'
        }
      >
        {modes.map(([id, label]) => (
          <button
            key={id}
            id={`btn-view-${id}`}
            aria-pressed={id === p.viewMode}
            onClick={() => p.onViewModeChange(id)}
            className={`min-w-0 min-h-9 rounded-lg text-[10px] sm:text-xs font-medium ${id === p.viewMode ? 'theme-surface shadow-sm' : 'theme-hover theme-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}
