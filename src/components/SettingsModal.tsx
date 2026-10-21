import { planningPreferences } from '../utils/assistantPlanning';
import { reminderLabel, colorLabel } from '../utils/i18n';
import { hashPin } from '../utils/security';
import {
  requestNotificationPermission,
  scheduleNativeReminders,
} from '../utils/notifications';
import { MAX_IMPORT_BYTES, validateEvents } from '../utils/validation';
import { downloadFile } from '../utils/storage';
import { Dialog } from './Dialog';
import React, { useState, useRef } from 'react';
import {
  AppSettings,
  CalendarEvent,
  GoogleCalendarColor,
  CalendarViewMode,
} from '../types';
import { exportEventsToICS, parseICSToEvents } from '../utils/storage';
import {
  AVAILABLE_THEMES,
  GOOGLE_CALENDAR_COLORS,
  STANDARD_REMINDER_OPTIONS,
} from '../utils/constants';
import { generateHolidayEvents } from '../utils/holidays';
import {
  playNotificationSound,
  triggerVibration,
} from '../utils/notifications';
import { getTranslation, AppLanguage } from '../utils/i18n';
import {
  X,
  Shield,
  KeyRound,
  Bell,
  Sparkles,
  Download,
  Upload,
  Trash2,
  Volume2,
  Check,
  AlertTriangle,
  Smartphone,
  Palette,
  Clock,
  Calendar,
  Layers,
  Flag,
  Languages,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  events: CalendarEvent[];
  onImportEvents: (importedEvents: CalendarEvent[]) => void | Promise<void>;
  onRemoveHolidays?: () => void | Promise<void>;
  onClearAllEvents: () => void | Promise<void>;
  onLockApp?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  events,
  onImportEvents,
  onRemoveHolidays,
  onClearAllEvents,
  onLockApp,
}) => {
  const lang: AppLanguage = settings.language || 'en';
  const t = getTranslation(lang);
  const planning = planningPreferences(settings.ai.planning);
  const updatePlanning = (patch: Partial<typeof planning>) => onUpdateSettings({ ...settings, ai: { ...settings.ai, planning: { ...planning, ...patch } } });

  const [pinInput, setPinInput] = useState(settings.security.pinCode);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [holidaysToast, setHolidaysToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Count Polish holiday events in calendar
  const polishHolidaysInCal = events.filter(
    (e) => e.id.startsWith('pl-holiday-') || e.title.startsWith('🇵🇱 '),
  );

  const handleSavePin = async () => {
    if (settings.security.pinEnabled) {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        setPinError(
          lang === 'pl'
            ? 'PIN musi składać się z 4 cyfr!'
            : 'PIN must be 4 digits!',
        );
        return;
      }
    }
    setPinError(null);
    try {
      const hash = await hashPin(pinInput);
      onUpdateSettings({
        ...settings,
        security: { ...settings.security, ...hash },
      });
      setPinInput('');
    } catch (error) {
      setPinError(String(error));
      return;
    }
    setPinSuccess(
      lang === 'pl'
        ? 'PIN został zaktualizowany.'
        : 'PIN successfully updated.',
    );
    setTimeout(() => setPinSuccess(null), 3000);
  };

  const handleTogglePin = async (enabled: boolean) => {
    if (enabled && !settings.security.pinHash && !/^\d{4}$/.test(pinInput)) {
      setPinError(
        lang === 'pl' ? 'Wprowadź 4 cyfry PIN!' : 'Enter 4 digits PIN!',
      );
      return;
    }
    setPinError(null);
    try {
      const hash = pinInput ? await hashPin(pinInput) : {};
      onUpdateSettings({
        ...settings,
        security: { ...settings.security, ...hash, pinEnabled: enabled },
      });
      setPinInput('');
    } catch (error) {
      setPinError(String(error));
    }
  };

  const handleAddHolidays = async () => {
    try {
      const holidays = generateHolidayEvents();
      await onImportEvents(holidays);
      setHolidaysToast(t.holidaysAdded);
      setTimeout(() => setHolidaysToast(null), 3500);
    } catch (error) {
      setHolidaysToast(String(error));
    }
  };

  const handleRemoveHolidaysClick = async () => {
    try {
      if (onRemoveHolidays) await onRemoveHolidays();
    } catch (error) {
      setHolidaysToast(String(error));
      return;
    }
    setHolidaysToast(t.holidaysRemoved);
    setTimeout(() => setHolidaysToast(null), 3500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportStatus(
        lang === 'pl'
          ? 'Plik jest zbyt duży (maks. 10 MB)'
          : 'File too large (max 10 MB)',
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = file.name.endsWith('.json')
          ? validateEvents(JSON.parse(text).events)
          : parseICSToEvents(text);
        if (parsed.length > 0) {
          await onImportEvents(parsed);
          setImportStatus(
            lang === 'pl'
              ? `Pomyślnie zaimportowano ${parsed.length} wydarzeń z pliku .ics!`
              : `Successfully imported ${parsed.length} events from .ics file!`,
          );
        } else {
          setImportStatus(
            lang === 'pl'
              ? 'Nie znaleziono poprawnych wydarzeń w pliku .ics.'
              : 'No valid events found in .ics file.',
          );
        }
      } catch (error) {
        setImportStatus(String(error));
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Dialog
      onClose={onClose}
      label={t.settingsTitle}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="modal-settings"
        className="theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 space-y-2 theme-subtle text-xs">
          <button
            className="underline"
            onClick={async () => {
              try {
                const result = await requestNotificationPermission();
                if (result === 'granted') await scheduleNativeReminders(events);
                setImportStatus(
                  result === 'granted'
                    ? lang === 'pl'
                      ? 'Powiadomienia włączone'
                      : 'Notifications enabled'
                    : lang === 'pl'
                      ? 'Brak zgody na powiadomienia'
                      : 'Notification permission denied',
                );
              } catch (error) {
                setImportStatus(String(error));
              }
            }}
          >
            {lang === 'pl'
              ? 'Włącz powiadomienia systemowe'
              : 'Enable system notifications'}
          </button>
          <p>
            {lang === 'pl'
              ? 'W przeglądarce przypomnienia wymagają działającej aplikacji. Android może planować je systemowo.'
              : 'Browser reminders require the app to be running. Android can schedule them with the system.'}
          </p>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 theme-border border-b theme-subtle">
          <h3 className="text-base font-bold theme-text">{t.settingsTitle}</h3>
          <button
            id="btn-close-settings-modal"
            aria-label={t.close}
            onClick={onClose}
            className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh] divide-y theme-border">
          {/* Section 0: Wybór języka (Language Selector) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">{t.language}</h4>
                <p className="text-xs theme-muted">{t.languageDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, language: 'pl' })
                }
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  lang === 'pl'
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 font-bold theme-text'
                    : 'theme-border theme-subtle theme-muted hover:theme-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇵🇱</span>
                  <span className="text-xs">Polski</span>
                </div>
                {lang === 'pl' && <Check className="w-4 h-4 text-blue-500" />}
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, language: 'en' })
                }
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  lang === 'en'
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 font-bold theme-text'
                    : 'theme-border theme-subtle theme-muted hover:theme-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇬🇧</span>
                  <span className="text-xs">English</span>
                </div>
                {lang === 'en' && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            </div>
          </div>

          {/* Section 1: Motyw kolorystyczny */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">{t.theme}</h4>
                <p className="text-xs theme-muted">{t.themeDesc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {AVAILABLE_THEMES.map((th) => {
                const isSelected = settings.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        theme: th.id,
                      });
                    }}
                    className={`relative p-3 rounded-2xl border text-left transition-all flex flex-col justify-between overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-xs theme-surface'
                        : 'theme-border hover:opacity-90 theme-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center border border-black/20 shadow-xs"
                        style={{ backgroundColor: th.dotColor }}
                      >
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${th.chipClass}`}
                      >
                        {th.badge}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold theme-text leading-tight">
                        {th.name}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 text-indigo-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Domyślne parametry nowych wydarzeń */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">
                  {t.defaultEventSettings}
                </h4>
                <p className="text-xs theme-muted">
                  {lang === 'pl'
                    ? 'Ułatw szybkie dodawanie terminów'
                    : 'Create events faster'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Domyślny czas trwania */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  {t.defaultDuration}
                </label>
                <select
                  value={settings.defaultEventDuration || 60}
                  onChange={(e) => {
                    onUpdateSettings({
                      ...settings,
                      defaultEventDuration: Number(e.target.value),
                    });
                  }}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={15}>15 minut</option>
                  <option value={30}>30 minut</option>
                  <option value={45}>45 minut</option>
                  <option value={60}>1 godzina (60 min)</option>
                  <option value={90}>1.5 godziny (90 min)</option>
                  <option value={120}>2 godziny (120 min)</option>
                </select>
              </div>

              {/* Domyślne przypomnienie */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  {t.defaultReminderLabel}
                </label>
                <select
                  value={
                    settings.defaultReminder !== undefined
                      ? settings.defaultReminder
                      : 15
                  }
                  onChange={(e) => {
                    onUpdateSettings({
                      ...settings,
                      defaultReminder: Number(e.target.value),
                    });
                  }}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STANDARD_REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {reminderLabel(opt.value, lang)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Domyślny kolor wpisów */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  {t.defaultColorLabel}
                </label>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {(
                    Object.keys(GOOGLE_CALENDAR_COLORS) as GoogleCalendarColor[]
                  ).map((cKey) => {
                    const cDef = GOOGLE_CALENDAR_COLORS[cKey];
                    const isSelected =
                      (settings.defaultColor || 'peacock') === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({
                            ...settings,
                            defaultColor: cKey,
                          });
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                          isSelected
                            ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-black'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: cDef.dot }}
                        title={colorLabel(cDef.id, lang, cDef.name)}
                      >
                        {isSelected && (
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Domyślny widok po otwarciu */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  {lang === 'pl'
                    ? 'Domyślny widok kalendarza:'
                    : 'Default calendar view:'}
                </label>
                <select
                  value={settings.defaultView || 'month'}
                  onChange={(e) => {
                    onUpdateSettings({
                      ...settings,
                      defaultView: e.target.value as CalendarViewMode,
                    });
                  }}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="month">
                    {lang === 'pl' ? 'Miesiąc' : 'Month'}
                  </option>
                  <option value="week">
                    {lang === 'pl' ? 'Tydzień' : 'Week'}
                  </option>
                  <option value="day">{lang === 'pl' ? 'Dzień' : 'Day'}</option>
                  <option value="agenda">
                    {lang === 'pl' ? 'Harmonogram' : 'Schedule'}
                  </option>
                  <option value="year">{lang === 'pl' ? 'Rok' : 'Year'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Dźwięki i wibracje powiadomień */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">
                  {t.soundAndVib}
                </h4>
                <p className="text-xs theme-muted">
                  {lang === 'pl'
                    ? 'Dźwięki powiadomień i wibracja'
                    : 'Notification sounds and vibration'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between p-3 rounded-2xl theme-subtle theme-border border">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold theme-text">
                    {t.soundEnabled}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={playNotificationSound}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg theme-surface theme-hover theme-border border theme-text"
                  >
                    {t.testSound}
                  </button>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        soundEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl theme-subtle theme-border border">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold theme-text">
                    {t.vibrationEnabled}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerVibration()}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg theme-surface theme-hover theme-border border theme-text"
                  >
                    {t.testVibration}
                  </button>
                  <input
                    type="checkbox"
                    checked={settings.vibrationEnabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        vibrationEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Lokalny Asystent Kalendarza (Offline NLP) */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold theme-text">
                    {t.aiAssistantTitle}
                  </h4>
                  <p className="text-xs theme-muted">{t.aiAssistantDesc}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai.enabled}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      ai: {
                        ...settings.ai,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-500/30 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            <p className="text-xs theme-muted leading-relaxed">
              {lang === 'pl'
                ? 'Asystent działa w 100% lokalnie na Twoim urządzeniu. Analizuje grafik, wolny czas, wykrywa kolizje i planuje spotkania ze zdań.'
                : 'The assistant runs 100% locally on your device. It analyzes your schedule, checks free time, and extracts events from natural language.'}
            </p>
          </div>

          <fieldset className="space-y-3 py-4 theme-border border-t">
            <legend className="text-sm font-semibold theme-text">{lang === 'pl' ? 'Preferencje planowania asystenta' : 'Assistant planning preferences'}</legend>
            <div className="flex flex-wrap gap-3">
              <label className="text-xs theme-muted">{lang === 'pl' ? 'Od godziny' : 'Start time'}
                <input aria-label={lang === 'pl' ? 'Początek dnia' : 'Day start'} type="time" value={planning.dayStart} max={planning.dayEnd} onChange={e => { if (e.target.value && e.target.value < planning.dayEnd) updatePlanning({ dayStart: e.target.value }); }} className="block theme-surface theme-text p-2 rounded" />
              </label>
              <label className="text-xs theme-muted">{lang === 'pl' ? 'Do godziny' : 'End time'}
                <input aria-label={lang === 'pl' ? 'Koniec dnia' : 'Day end'} type="time" value={planning.dayEnd} min={planning.dayStart} onChange={e => { if (e.target.value > planning.dayStart) updatePlanning({ dayEnd: e.target.value }); }} className="block theme-surface theme-text p-2 rounded" />
              </label>
              <label className="text-xs theme-muted">{lang === 'pl' ? 'Przerwa między wydarzeniami (min)' : 'Buffer between events (min)'}
                <input type="number" min="0" max="180" value={planning.bufferMinutes} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 180) updatePlanning({ bufferMinutes: value }); }} className="block w-24 theme-surface theme-text p-2 rounded" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 0].map((day, i) => <label key={day} className="flex gap-1 items-center text-xs theme-text">
                <input type="checkbox" checked={planning.workingDays.includes(day)} onChange={e => updatePlanning({ workingDays: e.target.checked ? [...planning.workingDays, day] : planning.workingDays.filter(d => d !== day) })} />
                {(lang === 'pl' ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])[i]}
              </label>)}
            </div>
            <p className="text-xs theme-muted">{lang === 'pl' ? 'Dotyczy propozycji asystenta i wolnych okienek. Nie zmienia istniejących wydarzeń.' : 'Used for assistant suggestions and free slots. Existing events are not changed.'}</p>
          </fieldset>

          {/* Section 5: Blokada kodem PIN */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold theme-text">{t.pinLock}</h4>
                  <p className="text-xs theme-muted">
                    {t.pinLockDesc}
                    <span className="block text-xs theme-muted">
                      {lang === 'pl'
                        ? 'Blokada ekranu nie szyfruje wydarzeń.'
                        : 'The screen lock does not encrypt your events.'}
                    </span>
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  aria-label={t.pinLock}
                  checked={settings.security.pinEnabled}
                  onChange={(e) => handleTogglePin(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-500/30 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {true && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">
                    {lang === 'pl'
                      ? 'Ustaw kod PIN (4 cyfry):'
                      : 'Set a 4-digit PIN:'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    aria-label="PIN"
                    autoComplete="new-password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) =>
                      setPinInput(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="••••"
                    className="w-24 text-center tracking-widest text-base font-bold px-3 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSavePin}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    {lang === 'pl' ? 'Zapisz PIN' : 'Save PIN'}
                  </button>
                  {onLockApp && settings.security.pinEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLockApp();
                      }}
                      className="px-3 py-1.5 theme-subtle theme-hover theme-border border theme-text rounded-xl text-xs font-medium transition-colors"
                    >
                      {lang === 'pl' ? 'Zablokuj teraz' : 'Lock now'}
                    </button>
                  )}
                </div>

                {pinError && (
                  <p className="text-xs text-rose-400 font-medium">
                    {pinError}
                  </p>
                )}
                {pinSuccess && (
                  <p className="text-xs text-emerald-400 font-medium">
                    {pinSuccess}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 6: Polskie święta i dni ustawowo wolne od pracy */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                <Flag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">
                  {t.holidaysSection}
                </h4>
                <p className="text-xs theme-muted">{t.holidaysDesc}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl theme-subtle theme-border border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="theme-muted">{t.holidaysInCalendar}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                    polishHolidaysInCal.length > 0
                      ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                      : 'theme-subtle theme-muted border theme-border'
                  }`}
                >
                  {polishHolidaysInCal.length} {t.holidaysUnit}
                </span>
              </div>

              {polishHolidaysInCal.length > 0 ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleAddHolidays}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {t.updateHolidaysBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveHolidaysClick}
                    className="w-full py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-400 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.removeHolidaysBtn}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddHolidays}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {t.addHolidaysBtn}
                </button>
              )}

              {holidaysToast && (
                <p className="text-xs text-emerald-400 font-semibold text-center pt-1 animate-in fade-in">
                  {holidaysToast}
                </p>
              )}
            </div>
          </div>

          <label className="block text-xs theme-muted">
            {lang === 'pl'
              ? 'Automatyczna blokada po minutach bezczynności'
              : 'Auto-lock after minutes of inactivity'}{' '}
            <input
              aria-label="Auto-lock minutes"
              className="theme-input w-16 p-1 rounded"
              type="number"
              min={1}
              max={60}
              value={settings.security.autoLockMinutes}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  security: {
                    ...settings.security,
                    autoLockMinutes: Math.max(
                      1,
                      Math.min(60, Number(e.target.value) || 1),
                    ),
                  },
                })
              }
            />
          </label>
          {/* Section 7: Kopia zapasowa i zarządzanie danymi */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">
                  {t.backupAndData}
                </h4>
                <p className="text-xs theme-muted">
                  {lang === 'pl' ? 'Lokalne wydarzenia:' : 'Local events:'}{' '}
                  <strong>{events.length}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs theme-muted">
              {lang === 'pl'
                ? 'Import scala wydarzenia z obecnym kalendarzem. JSON zachowuje wszystkie dane wydarzeń.'
                : 'Import merges events with your calendar. JSON preserves all event fields.'}
            </p>
            <button
              className="theme-input rounded-lg p-2 text-xs"
              onClick={() =>
                downloadFile(
                  JSON.stringify({ version: 1, events }, null, 2),
                  'kalendarz-backup.json',
                )
              }
            >
              {lang === 'pl'
                ? 'Pełna kopia wydarzeń JSON'
                : 'Full event backup (JSON)'}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    exportEventsToICS(events);
                  } catch (error) {
                    setImportStatus(String(error));
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl theme-subtle theme-hover theme-border border text-xs font-semibold theme-text transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 opacity-70" />
                {t.downloadIcs}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl theme-subtle theme-hover theme-border border text-xs font-semibold theme-text transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 opacity-70" />
                {t.uploadIcs}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".ics,.json,text/calendar,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {importStatus && (
              <p className="text-xs text-blue-400 font-semibold">
                {importStatus}
              </p>
            )}

            <div className="pt-2">
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.clearAllEvents}
                </button>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    {t.clearConfirm} ({events.length})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onClearAllEvents();
                          setConfirmClear(false);
                        } catch (error) {
                          setImportStatus(String(error));
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      {t.yesDelete}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-1.5 theme-subtle theme-hover theme-border border theme-text rounded-xl text-xs font-medium transition-colors"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 theme-subtle theme-border border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
