import { CalendarNavigation } from './components/CalendarNavigation';
import { applyTheme } from './utils/themes';
import { tr } from './utils/i18n';
import { updateNativeAppName } from './utils/nativeDevice';
import { applyAssistantChanges, signalCalendarChange, type AssistantChange } from './utils/calendarStore';
import { changesForPlan } from './utils/assistantChanges';
import type { AssistantPlan } from './utils/assistantPlanning';
import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  memo,
  useRef,
} from 'react';
import type { CalendarEvent, CalendarViewMode, AppSettings } from './types';
import {
  loadStoredSettings,
  saveStoredSettings,
} from './utils/settingsStorage';
import {
  checkEventReminders,
  playNotificationSound,
  triggerVibration,
  scheduleNativeReminders,
} from './utils/notifications';
import { localDate, shiftMonth, pad2 } from './utils/dates';
import { hashPin } from './utils/security';
import { useCalendar } from './hooks/useCalendar';
import { useNow } from './hooks/useNow';
import { TopNavBar } from './components/TopNavBar';
import { MonthView } from './components/MonthView';
import { DayWeekView } from './components/DayWeekView';
import { YearView } from './components/YearView';
import { AgendaView } from './components/AgendaView';
import { BottomNavMobile } from './components/BottomNavMobile';
import { PinLockScreen } from './components/PinLockScreen';
import { NotificationBanner } from './components/NotificationBanner';
import { Plus } from 'lucide-react';
import { AppUpdate } from './components/AppUpdate';
import { Capacitor } from '@capacitor/core';
const EventModal = lazy(() =>
  import('./components/EventModal').then((m) => ({ default: m.EventModal })),
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({
    default: m.SettingsModal,
  })),
);
const AiAssistantDrawer = lazy(() =>
  import('./components/AiAssistantDrawer').then((m) => ({
    default: m.AiAssistantDrawer,
  })),
);
const SyncModal = lazy(() =>
  import('./components/SyncModal').then((m) => ({ default: m.SyncModal })),
);
const SearchModal = lazy(() =>
  import('./components/SearchModal').then((m) => ({ default: m.SearchModal })),
);
const DownloadModal = lazy(() =>
  import('./components/DownloadModal').then((m) => ({
    default: m.DownloadModal,
  })),
);

const CalendarPanel = memo(function CalendarPanel({
  currentDate,
  viewMode,
  events,
  onSelectDay,
  onSelectEvent,
  onCreateAtTime,
  onSelectMonth,
  onFocusDate,
  monthDay,
  startOfWeek,
  language,
  now,
}: {
  currentDate: Date;
  viewMode: CalendarViewMode;
  events: CalendarEvent[];
  onSelectDay: (date: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateAtTime: (date: string, hour: number) => void;
  onSelectMonth: (month: number) => void;
  onFocusDate: (date: string | null) => void;
  monthDay: string | null;
  startOfWeek: number;
  language: import('./utils/i18n').AppLanguage;
  now: Date;
}) {
  return (
    <main className="calendar-workspace">
      {viewMode === 'year' && (
        <YearView
          startOfWeek={startOfWeek}
          {...{
            currentDate,
            events,
            onSelectMonth,
            onSelectDay,
            language,
            now,
          }}
        />
      )}
      {viewMode === 'month' && (
        <MonthView
          key={localDate(currentDate).slice(0, 7)}
          onFocusDate={onFocusDate}
          selectedDate={monthDay}
          startOfWeek={startOfWeek}
          {...{
            currentDate,
            events,
            onSelectDay,
            onSelectEvent,
            language,
            now,
          }}
        />
      )}
      {(viewMode === 'week' || viewMode === 'day') && (
        <DayWeekView
          startOfWeek={startOfWeek}
          {...{
            currentDate,
            viewMode,
            events,
            onSelectEvent,
            onSelectDay,
            onCreateAtTime,
            language,
            now,
          }}
        />
      )}
      {viewMode === 'agenda' && (
        <AgendaView
          {...{ events, onSelectEvent, onSelectDay, language, now }}
          startDate={localDate(currentDate)}
        />
      )}
    </main>
  );
});

export default function App() {
  const {
    events,
    deletions,
    ready,
    error,
    commit,
    save: saveRecords,
    remove,
    refresh,
  } = useCalendar();
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings);
  const [settingsError, setSettingsError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthDay, setMonthDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>(
    settings.defaultView || 'month',
  );
  const [modal, setModal] = useState<
    'event' | 'settings' | 'ai' | 'sync' | 'search' | 'download' | null
  >(null);
  const [assistantMounted, setAssistantMounted] = useState(false);
  useEffect(() => { if (modal === 'ai') setAssistantMounted(true); }, [modal]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [initialDate, setInitialDate] = useState<string>();
  const [initialTime, setInitialTime] = useState<string>();
  const [isPinLocked, setIsPinLocked] = useState(settings.security.pinEnabled);
  const [activeNotification, setActiveNotification] = useState<{
    event: CalendarEvent;
    minutesBefore: number;
  } | null>(null);
  const now = useNow();
  const language = settings.language || 'en';
  const [assistantUndo, setAssistantUndo] = useState<AssistantChange[] | null>(null);
  const updateSettings = useCallback((next: AppSettings) => {
    try {
      saveStoredSettings(next);
      setSettings(next);
      setSettingsError('');
      return true;
    } catch (e) {
      setSettingsError(
        `Nie zapisano ustawień / Settings were not saved: ${String(e)}`,
      );
      return false;
    }
  }, []);
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === 'offline_calendar_settings_v2') {
        const next = loadStoredSettings();
        setSettings(next);
        if (next.security.pinEnabled) setIsPinLocked(true);
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  useEffect(() => {
    if (settings.security.pinCode && !settings.security.pinHash) {
      let active = true;
      void hashPin(settings.security.pinCode)
        .then((hash) => {
          if (active)
            updateSettings({
              ...settings,
              security: { ...settings.security, ...hash },
            });
        })
        .catch((e) => setSettingsError(String(e)));
      return () => {
        active = false;
      };
    }
  }, [settings, updateSettings]);
  useLayoutEffect(() => {
    document.title = tr(language, 'Kalendarz', 'Calendar');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.documentElement.lang = language;
    applyTheme(document.documentElement, settings);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        getComputedStyle(document.documentElement)
          .getPropertyValue('--bg-main')
          .trim(),
      );
  }, [language, settings.theme, settings.customThemes]);
  useEffect(() => {
    void updateNativeAppName(language).catch(error => setSettingsError(String(error)));
  }, [language]);
  const lock = useCallback(() => {
    setModal(null);
    setIsPinLocked(true);
  }, []);
  useEffect(() => {
    if (!settings.security.pinEnabled) return;
    const timeout = Math.max(1, settings.security.autoLockMinutes || 5) * 60000;
    let last = Date.now();
    const activity = () => {
      if (Date.now() - last >= timeout) {
        lock();
      }
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last >= timeout) lock();
    };
    const timer = setInterval(check, 10000);
    const visible = () => {
      if (document.hidden) {
        sessionStorage.setItem('calendar-hidden', String(Date.now()));
      } else {
        check();
      }
    };
    for (const key of ['pointerdown', 'keydown', 'touchstart'])
      window.addEventListener(key, activity, { passive: true });
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      for (const key of ['pointerdown', 'keydown', 'touchstart'])
        window.removeEventListener(key, activity);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [settings.security.pinEnabled, settings.security.autoLockMinutes, lock]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!isPinLocked && (e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setModal('search');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [isPinLocked]);
  const lastCheck = useRef(Date.now() - 60000);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const at = new Date();
      checkEventReminders(
        events,
        (event, minutesBefore) => {
          if (isPinLocked) return;
          setActiveNotification({ event, minutesBefore });
          if (settings.soundEnabled) playNotificationSound();
          if (settings.vibrationEnabled) triggerVibration();
        },
        at,
        lastCheck.current,
        !isPinLocked,
      );
      lastCheck.current = at.getTime();
    };
    const scheduledCheck = () => {
      if (navigator.locks)
        void navigator.locks.request(
          'offline-calendar-reminders',
          { ifAvailable: true },
          (lock) => {
            if (lock) check();
          },
        );
      else check();
    };
    scheduledCheck();
    const timer = setInterval(scheduledCheck, 30000);
    document.addEventListener('visibilitychange', scheduledCheck);
    void scheduleNativeReminders(events, isPinLocked).catch((e) =>
      setSettingsError(String(e)),
    );
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', scheduledCheck);
    };
  }, [
    events,
    ready,
    settings.soundEnabled,
    settings.vibrationEnabled,
    isPinLocked,
  ]);
  const navigate = useCallback(
    (direction: number) => {
      setMonthDay(null);
      setCurrentDate((prev) => {
        if (
          viewMode === 'month' ||
          viewMode === 'agenda' ||
          viewMode === 'year'
        )
          return shiftMonth(prev, direction * (viewMode === 'year' ? 12 : 1));
        const next = new Date(prev);
        next.setDate(
          prev.getDate() + direction * (viewMode === 'week' ? 7 : 1),
        );
        return next;
      });
    },
    [viewMode],
  );
  const today = useCallback(() => { setMonthDay(null); setCurrentDate(new Date()); }, []);
  const changeView = useCallback((mode: CalendarViewMode) => {
    if (viewMode === 'month' && monthDay && mode !== 'month') setCurrentDate(new Date(`${monthDay}T12:00:00`));
    if (mode !== viewMode) setMonthDay(null);
    setViewMode(mode);
  }, [viewMode, monthDay]);
  const create = useCallback((date?: string, time?: string) => {
    setSelectedEvent(null);
    setInitialDate(date || localDate());
    setInitialTime(time || '10:00');
    setModal('event');
  }, []);
  const select = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setInitialDate(undefined);
    setInitialTime(undefined);
    setModal('event');
  }, []);
  const selectDay = useCallback((date: string) => {
    setMonthDay(null);
    setCurrentDate(new Date(`${date}T12:00:00`));
    setViewMode('day');
  }, []);
  const selectMonth = useCallback((month: number) => {
    setMonthDay(null);
    setCurrentDate((prev) => shiftMonth(prev, month - prev.getMonth()));
    setViewMode('month');
  }, []);
  const createAt = useCallback(
    (date: string, hour: number) => create(date, `${pad2(hour)}:00`),
    [create],
  );
  const close = useCallback(() => setModal(null), []);
  const save = useCallback(
    async (event: CalendarEvent) => {
      await saveRecords([event]);
      setModal(null);
    },
    [saveRecords],
  );
  const deleteEvent = useCallback(
    async (id: string) => {
      await remove([id]);
      setModal(null);
    },
    [remove],
  );
  const applyAiPlan = useCallback(async (plan: AssistantPlan) => {
    const inverse = await applyAssistantChanges(changesForPlan(plan));
    setAssistantUndo(inverse);
    signalCalendarChange();
    await refresh();
  }, [refresh]);
  const undoAiPlan = useCallback(async () => {
    if (!assistantUndo) return;
    await applyAssistantChanges(assistantUndo);
    setAssistantUndo(null);
    signalCalendarChange();
    await refresh();
  }, [assistantUndo, refresh]);
  if (isPinLocked && settings.security.pinEnabled)
    return (
      <PinLockScreen
        security={settings.security}
        onUnlock={() => setIsPinLocked(false)}
        language={language}
      />
    );
  return (
    <div className="h-dvh overflow-hidden theme-bg theme-text flex flex-col w-full max-w-full">
      {!Capacitor.isNativePlatform() && location.protocol !== 'file:' && (
        <AppUpdate language={language} />
      )}
      {(error || settingsError) && (
        <div role="alert" className="p-3 bg-red-800 text-white">
          {error || settingsError}
          <button className="ml-3 underline" onClick={() => location.reload()}>
            {tr(language, 'Spróbuj ponownie', 'Retry')}
          </button>
        </div>
      )}
      {!ready ? (
        <p role="status" className="p-4">
          {tr(language, 'Wczytywanie kalendarza…', 'Loading calendar…')}
        </p>
      ) : (
        <>
          <TopNavBar
            startOfWeek={settings.startOfWeek}
            currentDate={currentDate}
            viewMode={viewMode}
            onViewModeChange={changeView}
            onNavigatePrev={() => navigate(-1)}
            onNavigateNext={() => navigate(1)}
            onNavigateToday={today}
            onOpenCreateModal={() => create()}
            onOpenAiDrawer={() => setModal('ai')}
            onOpenSettings={() => setModal('settings')}
            onOpenSync={() => setModal('sync')}
            onOpenSearch={() => setModal('search')}
            onOpenDownload={() => setModal('download')}
            isAiEnabled={settings.ai.enabled}
            language={language}
          />
          <NotificationBanner
            language={language}
            activeNotification={activeNotification}
            onDismiss={() => setActiveNotification(null)}
            onOpenEvent={select}
          />
          <CalendarNavigation enabled={ready && !isPinLocked && !modal} allowHorizontalScroll={viewMode === 'week'} dateKey={`${localDate(currentDate)}:${viewMode}`} onNavigate={navigate}>
          <CalendarPanel
            {...{
              currentDate,
              viewMode,
              events,
              onSelectDay: selectDay,
              onSelectEvent: select,
              onCreateAtTime: createAt,
              onSelectMonth: selectMonth,
              onFocusDate: setMonthDay,
              monthDay,
              startOfWeek: settings.startOfWeek,
              language,
              now,
            }}
          />
          </CalendarNavigation>
          <BottomNavMobile
            viewMode={viewMode}
            onViewModeChange={changeView}
            todayDayNumber={now.getDate()}
            onNavigateToday={today}
            language={language}
          />
          <button
            id="btn-mobile-fab-create"
            onClick={() => create()}
            aria-label={tr(language, 'Dodaj wydarzenie', 'Create event')}
            className="sm:hidden fixed bottom-18 right-5 w-13 h-13 rounded-full theme-primary bg-blue-600 text-white shadow-xl z-40 flex items-center justify-center"
          >
            <Plus />
          </button>
          <Suspense
            fallback={
              <p
                role="status"
                className="fixed bottom-2 left-2 theme-surface p-2"
              >
                {tr(language, 'Wczytywanie…', 'Loading…')}
              </p>
            }
          >
            {modal === 'event' && (
              <EventModal
                isOpen
                eventToEdit={selectedEvent}
                initialDate={initialDate}
                initialTime={initialTime}
                defaultColor={settings.defaultColor}
                defaultReminder={settings.defaultReminder}
                defaultDuration={settings.defaultEventDuration}
                onClose={close}
                onSave={save}
                onDelete={deleteEvent}
                language={language}
              />
            )}
            {modal === 'settings' && (
              <SettingsModal
                isOpen
                onClose={close}
                settings={settings}
                onUpdateSettings={updateSettings}
                events={events}
                onImportEvents={saveRecords}
                onRemoveHolidays={() =>
                  remove(
                    events
                      .filter((e) => e.id.startsWith('pl-holiday-'))
                      .map((e) => e.id),
                  )
                }
                onClearAllEvents={() => remove(events.map((e) => e.id))}
                onLockApp={lock}
              />
            )}
            {(assistantMounted || modal === 'ai') && (
              <AiAssistantDrawer
                isOpen={modal === 'ai'}
                onClose={close}
                events={events}
                onApplyPlan={applyAiPlan}
                onUndo={undoAiPlan}
                canUndo={Boolean(assistantUndo)}
                aiSettings={settings.ai}
                language={language}
              />
            )}
            {modal === 'sync' && (
              <SyncModal
                isOpen
                onClose={close}
                events={events}
                deletions={deletions}
                onSyncMergeEvents={commit}
                currentTheme={settings.theme}
                currentCustomTheme={settings.customThemes?.find(theme => theme.id === settings.theme)}
                onSyncTheme={(theme, customTheme) => updateSettings({ ...settings, theme, customThemes: customTheme ? [...(settings.customThemes || []).filter(value => value.id !== customTheme.id), customTheme] : settings.customThemes })}
                language={language}
              />
            )}
            {modal === 'search' && (
              <SearchModal
                isOpen
                onClose={close}
                events={events}
                onSelectEvent={select}
                language={language}
              />
            )}
            {modal === 'download' && (
              <DownloadModal isOpen onClose={close} language={language} />
            )}
          </Suspense>
        </>
      )}
    </div>
  );
}
