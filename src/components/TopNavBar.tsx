import { tr } from '../utils/i18n';
import React from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, Settings,
  ArrowLeftRight, Search, Download,
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
  const language = p.language || 'en';
  const t = getTranslation(language);
  const modes = [
    ['year', t.year], ['month', t.month], ['week', t.week],
    ['day', t.day], ['agenda', t.agenda],
  ] as const;
  const actions = [
    { id: 'btn-open-search', label: t.search, click: p.onOpenSearch, Icon: Search,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20' },
    ...(p.isAiEnabled ? [{ id: 'btn-open-ai-assistant', label: t.assistant, click: p.onOpenAiDrawer, Icon: Sparkles,
      color: 'text-violet-500 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/20' }] : []),
    { id: 'btn-open-sync', label: t.sync, click: p.onOpenSync, Icon: ArrowLeftRight,
      color: 'text-teal-500 bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/20' },
    { id: 'btn-open-settings', label: t.settings, click: p.onOpenSettings, Icon: Settings,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/20' },
    ...(p.onOpenDownload ? [{ id: 'btn-open-download', label: tr(language, 'Pobierz aplikację', 'Download app'), click: p.onOpenDownload, Icon: Download,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/20' }] : []),
  ];
  return (
    <header className="shrink-0 sticky top-0 z-30 theme-header theme-border border-b px-3 sm:px-4 safe-top pb-2">
      <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:gap-5 min-w-0">
          <div className="min-w-0">
            <p className="text-[11px] font-medium theme-muted leading-4">{t.appName}</p>
            <h2 className="text-sm sm:text-lg font-semibold whitespace-nowrap">
              {MONTH_NAMES[language][p.currentDate.getMonth()]}{' '}
              <span className="theme-muted font-normal">{p.currentDate.getFullYear()}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button id="btn-nav-today" onClick={p.onNavigateToday}
              className="min-h-11 sm:min-h-10 px-3 rounded-xl theme-border border theme-hover text-xs font-semibold">
              {t.today}
            </button>
            <button id="btn-nav-prev" aria-label={tr(language, 'Poprzedni', 'Previous')}
              onClick={p.onNavigatePrev} className="w-9 h-11 sm:h-10 rounded-lg theme-hover flex items-center justify-center">
              <ChevronLeft size={18} />
            </button>
            <button id="btn-nav-next" aria-label={tr(language, 'Następny', 'Next')}
              onClick={p.onNavigateNext} className="w-9 h-11 sm:h-10 rounded-lg theme-hover flex items-center justify-center">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-1">
          {actions.map(({ id, label, click, Icon, color }) => (
            <button key={id} id={id} aria-label={label} title={label} onClick={click}
              className={`flex-1 sm:flex-none sm:w-10 h-11 sm:h-10 min-w-0 rounded-xl border flex items-center justify-center transition-colors ${color}`}>
              <Icon size={20} />
            </button>
          ))}
          <button id="btn-create-event-top" onClick={p.onOpenCreateModal}
            className="hidden sm:flex items-center gap-1 min-h-10 px-3 bg-blue-600 text-white rounded-lg text-xs">
            <Plus size={18} />{t.create}
          </button>
        </div>
      </div>
      <nav className="hidden sm:grid grid-cols-5 gap-1 max-w-2xl mx-auto mt-2 theme-subtle p-1 rounded-xl"
        aria-label={tr(language, 'Widoki kalendarza', 'Calendar views')}>
        {modes.map(([id, label]) => (
          <button key={id} id={`btn-view-${id}`} aria-pressed={id === p.viewMode}
            onClick={() => p.onViewModeChange(id)}
            className={`min-w-0 min-h-9 rounded-lg text-xs font-medium ${id === p.viewMode ? 'theme-surface shadow-sm' : 'theme-hover theme-muted'}`}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
