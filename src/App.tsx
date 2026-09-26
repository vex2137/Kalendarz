import React, { useState, useEffect, useCallback } from 'react';
import { 
  CalendarEvent, 
  CalendarViewMode, 
  AppSettings 
} from './types';
import { 
  loadStoredEvents, 
  saveStoredEvents, 
  loadStoredSettings, 
  saveStoredSettings 
} from './utils/storage';
import { AVAILABLE_THEMES } from './utils/constants';
import { 
  checkEventReminders, 
  playNotificationSound, 
  triggerVibration, 
  requestNotificationPermission 
} from './utils/notifications';
import { TopNavBar } from './components/TopNavBar';
import { MonthView } from './components/MonthView';
import { DayWeekView } from './components/DayWeekView';
import { AgendaView } from './components/AgendaView';
import { EventModal } from './components/EventModal';
import { SettingsModal } from './components/SettingsModal';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { PinLockScreen } from './components/PinLockScreen';
import { NotificationBanner } from './components/NotificationBanner';
import { SyncModal } from './components/SyncModal';
import { SearchModal } from './components/SearchModal';
import { BuildGuideModal } from './components/BuildGuideModal';
import { Plus } from 'lucide-react';

export default function App() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadStoredEvents());
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    const saved = loadStoredSettings();
    return saved.defaultView || 'month';
  });

  // Modals & Panels state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>();
  const [modalInitialTime, setModalInitialTime] = useState<string | undefined>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isBuildGuideOpen, setIsBuildGuideOpen] = useState(false);

  // Security / PIN lock
  const [isPinLocked, setIsPinLocked] = useState<boolean>(
    () => settings.security.pinEnabled && settings.security.isLocked
  );

  // Notifications
  const [activeNotification, setActiveNotification] = useState<{
    event: CalendarEvent;
    minutesBefore: number;
  } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Sync events & settings to LocalStorage
  const updateEvents = useCallback((newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    saveStoredEvents(newEvents);
  }, []);

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
  }, []);

  // Sync data-theme attribute on <html> and <meta name="theme-color">
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const currentTheme = AVAILABLE_THEMES.find((t) => t.id === settings.theme);
      if (currentTheme) {
        metaThemeColor.setAttribute('content', currentTheme.dotColor);
      }
    }
  }, [settings.theme]);

  // Merge incoming synced events (two-way merge, no duplicates)
  const handleSyncMergeEvents = useCallback((incomingEvents: CalendarEvent[]) => {
    setEvents((current) => {
      const eventMap = new Map<string, CalendarEvent>();
      // Put existing events
      current.forEach((e) => {
        const key = e.id || `${e.title}_${e.startDate}_${e.startTime || ''}`;
        eventMap.set(key, e);
      });
      // Merge incoming
      incomingEvents.forEach((inc) => {
        const key = inc.id || `${inc.title}_${inc.startDate}_${inc.startTime || ''}`;
        const existing = eventMap.get(key);
        if (!existing) {
          eventMap.set(key, inc);
        } else {
          // If incoming is newer or existing has older timestamp, overwrite
          const existingTime = existing.updatedAt || existing.createdAt || 0;
          const incTime = inc.updatedAt || inc.createdAt || 0;
          if (incTime >= existingTime) {
            eventMap.set(key, { ...existing, ...inc });
          }
        }
      });
      const merged = Array.from(eventMap.values());
      saveStoredEvents(merged);
      return merged;
    });
  }, []);

  // Periodic reminder checker (runs every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      checkEventReminders(events, (event, minutesBefore) => {
        setActiveNotification({ event, minutesBefore });
        if (settings.soundEnabled) playNotificationSound();
        if (settings.vibrationEnabled) triggerVibration();
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [events, settings.soundEnabled, settings.vibrationEnabled]);

  // Request notification permission
  const handleRequestNotification = async () => {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
  };

  // Keyboard shortcut for search (Ctrl+F or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Date Navigation
  const handleNavigatePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() - 1);
      } else if (viewMode === 'week') {
        next.setDate(prev.getDate() - 7);
      } else if (viewMode === 'day') {
        next.setDate(prev.getDate() - 1);
      } else {
        next.setMonth(prev.getMonth() - 1);
      }
      return next;
    });
  };

  const handleNavigateNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() + 1);
      } else if (viewMode === 'week') {
        next.setDate(prev.getDate() + 7);
      } else if (viewMode === 'day') {
        next.setDate(prev.getDate() + 1);
      } else {
        next.setMonth(prev.getMonth() + 1);
      }
      return next;
    });
  };

  const handleNavigateToday = () => {
    setCurrentDate(new Date());
  };

  // Event modal actions
  const handleOpenCreateModal = (dateStr?: string, timeStr?: string) => {
    setSelectedEvent(null);
    setModalInitialDate(dateStr || new Date().toISOString().slice(0, 10));
    setModalInitialTime(timeStr || '10:00');
    setIsEventModalOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalInitialDate(undefined);
    setModalInitialTime(undefined);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (savedEvent: CalendarEvent) => {
    const existingIndex = events.findIndex((e) => e.id === savedEvent.id);
    if (existingIndex >= 0) {
      const updated = [...events];
      updated[existingIndex] = savedEvent;
      updateEvents(updated);
    } else {
      updateEvents([...events, savedEvent]);
    }
    setIsEventModalOpen(false);
  };

  const handleDeleteEvent = (eventId: string) => {
    updateEvents(events.filter((e) => e.id !== eventId));
    setIsEventModalOpen(false);
  };

  // Select day in Month or Agenda view
  const handleSelectDay = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d));
    setViewMode('day');
  };

  // AI assistant creates event
  const handleAddEventFromAi = (partial: Partial<CalendarEvent>) => {
    const newEvent: CalendarEvent = {
      id: 'ai-evt-' + Date.now(),
      title: partial.title || 'Nowe wydarzenie AI',
      description: partial.description || '',
      location: partial.location || '',
      startDate: partial.startDate || new Date().toISOString().slice(0, 10),
      startTime: partial.startTime || '12:00',
      endDate: partial.endDate || partial.startDate || new Date().toISOString().slice(0, 10),
      endTime: partial.endTime || '13:00',
      allDay: partial.allDay ?? false,
      color: partial.color || 'lavender',
      recurrence: partial.recurrence || 'NONE',
      reminders: partial.reminders || [15],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    updateEvents([...events, newEvent]);
    setIsAiDrawerOpen(false);
  };

  // PIN Lock Screen
  if (isPinLocked && settings.security.pinEnabled) {
    return (
      <PinLockScreen 
        correctPin={settings.security.pinCode}
        onUnlock={() => setIsPinLocked(false)}
      />
    );
  }

  return (
    <div className="min-h-screen theme-bg theme-text flex flex-col font-sans select-none pb-16 sm:pb-0 transition-colors duration-200">
      {/* Top App Bar */}
      <TopNavBar
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        onNavigateToday={handleNavigateToday}
        onOpenCreateModal={() => handleOpenCreateModal()}
        onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenBuildGuide={() => setIsBuildGuideOpen(true)}
        isAiEnabled={settings.ai.enabled}
        notificationPermission={notificationPermission}
        onRequestNotification={handleRequestNotification}
      />

      {/* Floating Notification Toast */}
      <NotificationBanner
        activeNotification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
        onOpenEvent={handleSelectEvent}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 sm:p-4">
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onSelectDay={handleSelectDay}
            onSelectEvent={handleSelectEvent}
          />
        )}

        {(viewMode === 'week' || viewMode === 'day') && (
          <DayWeekView
            currentDate={currentDate}
            viewMode={viewMode}
            events={events}
            onSelectEvent={handleSelectEvent}
            onCreateAtTime={(dateStr, hour) => {
              const hourStr = String(hour).padStart(2, '0') + ':00';
              handleOpenCreateModal(dateStr, hourStr);
            }}
          />
        )}

        {viewMode === 'agenda' && (
          <AgendaView
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectDay={handleSelectDay}
          />
        )}
      </main>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        id="btn-mobile-fab-create"
        onClick={() => handleOpenCreateModal()}
        aria-label="Dodaj wydarzenie"
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xl flex items-center justify-center z-40 transition-transform active:scale-95"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Event Modal (Create / Edit) */}
      <EventModal
        isOpen={isEventModalOpen}
        eventToEdit={selectedEvent}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        defaultColor={settings.defaultColor || 'peacock'}
        defaultReminder={settings.defaultReminder !== undefined ? settings.defaultReminder : 15}
        defaultDuration={settings.defaultEventDuration || 60}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        events={events}
        onImportEvents={(newEvts) => updateEvents(newEvts)}
        onClearAllEvents={() => updateEvents([])}
        onLockApp={() => setIsPinLocked(true)}
        onOpenBuildGuide={() => setIsBuildGuideOpen(true)}
      />

      {/* Local AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        events={events}
        onAddEventFromAi={handleAddEventFromAi}
        aiSettings={settings.ai}
      />

      {/* Accountless Sync Modal (PC <-> Phone) */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        events={events}
        onSyncMergeEvents={handleSyncMergeEvents}
        currentTheme={settings.theme}
        onSyncTheme={(newTheme) => {
          updateSettings({
            ...settings,
            theme: newTheme,
          });
        }}
      />

      {/* Search & Filter Modal (Ctrl+F) */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        events={events}
        onSelectEvent={handleSelectEvent}
      />

      {/* Build & Installation Guide (APK, Linux, Windows) */}
      <BuildGuideModal
        isOpen={isBuildGuideOpen}
        onClose={() => setIsBuildGuideOpen(false)}
      />
    </div>
  );
}
