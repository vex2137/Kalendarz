import React, { useState, useRef } from 'react';
import { 
  AppSettings, 
  CalendarEvent,
  AppTheme,
  GoogleCalendarColor,
  CalendarViewMode
} from '../types';
import { 
  exportEventsToICS, 
  parseICSToEvents 
} from '../utils/storage';
import { 
  AVAILABLE_THEMES,
  GOOGLE_CALENDAR_COLORS,
  STANDARD_REMINDER_OPTIONS
} from '../utils/constants';
import { generateHolidayEvents } from '../utils/holidays';
import { 
  playNotificationSound, 
  triggerVibration, 
  requestNotificationPermission 
} from '../utils/notifications';
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
  Monitor
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  events: CalendarEvent[];
  onImportEvents: (importedEvents: CalendarEvent[]) => void;
  onClearAllEvents: () => void;
  onLockApp?: () => void;
  onOpenBuildGuide?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  events,
  onImportEvents,
  onClearAllEvents,
  onLockApp,
  onOpenBuildGuide,
}) => {
  const [pinInput, setPinInput] = useState(settings.security.pinCode);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [holidaysAdded, setHolidaysAdded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSavePin = () => {
    if (settings.security.pinEnabled) {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        setPinError('PIN musi składać się dokładnie z 4 cyfr!');
        return;
      }
    }
    setPinError(null);
    onUpdateSettings({
      ...settings,
      security: {
        ...settings.security,
        pinCode: pinInput,
      },
    });
    setPinSuccess('PIN został pomyślnie zaktualizowany.');
    setTimeout(() => setPinSuccess(null), 3000);
  };

  const handleTogglePin = (enabled: boolean) => {
    if (enabled && (!pinInput || pinInput.length !== 4)) {
      setPinError('Wprowadź 4 cyfry PIN przed włączeniem blokady!');
      return;
    }
    setPinError(null);
    onUpdateSettings({
      ...settings,
      security: {
        ...settings.security,
        pinEnabled: enabled,
        pinCode: pinInput,
      },
    });
  };

  const handleTestSound = () => {
    playNotificationSound();
  };

  const handleTestVibration = () => {
    triggerVibration();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseICSToEvents(text);
        if (parsed.length > 0) {
          onImportEvents(parsed);
          setImportStatus(`Pomyślnie zaimportowano ${parsed.length} wydarzeń!`);
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          setImportStatus('Nie znaleziono poprawnych wydarzeń w pliku .ics.');
        }
      } catch {
        setImportStatus('Błąd podczas odczytu pliku .ics');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="modal-settings"
        className="theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 theme-border border-b theme-subtle">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold theme-text">Ustawienia kalendarza</h3>
          </div>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh] divide-y theme-border">
          {/* Section 1: Motyw kolorystyczny */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">Motyw kolorystyczny</h4>
                <p className="text-xs theme-muted">Dostosuj styl całej aplikacji</p>
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
                      <span className="w-4 h-4 rounded-full flex items-center justify-center border border-black/20 shadow-xs" style={{ backgroundColor: th.dotColor }}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${th.chipClass}`}>
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
                <h4 className="text-sm font-bold theme-text">Domyślne ustawienia wydarzeń</h4>
                <p className="text-xs theme-muted">Ułatw szybkie dodawanie terminów</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Domyślny czas trwania */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  Domyślny czas trwania:
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

              {/* Domyślne powiadomienie */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  Domyślne przypomnienie:
                </label>
                <select
                  value={settings.defaultReminder !== undefined ? settings.defaultReminder : 15}
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
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Domyślny widok po otwarciu */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  Domyślny widok kalendarza:
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
                  <option value="month">Widok miesiąca</option>
                  <option value="week">Widok tygodnia</option>
                  <option value="day">Widok dnia</option>
                  <option value="agenda">Harmonogram (Lista)</option>
                </select>
              </div>

              {/* Domyślny kolor */}
              <div className="space-y-1">
                <label className="text-xs font-semibold theme-text">
                  Domyślny kolor nowego wydarzenia:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {(Object.keys(GOOGLE_CALENDAR_COLORS) as GoogleCalendarColor[]).slice(0, 8).map((cKey) => {
                    const isSelected = (settings.defaultColor || 'peacock') === cKey;
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
                        className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                          isSelected ? 'scale-115 ring-2 ring-white shadow-xs' : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[cKey].dot }}
                        title={GOOGLE_CALENDAR_COLORS[cKey].name}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dźwięki i Alerty */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">Dźwięki i powiadomienia</h4>
                <p className="text-xs theme-muted">Sygnały dźwiękowe i wibracje na telefonie</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between p-3 rounded-2xl theme-subtle theme-border border">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold theme-text">Dźwięk powiadomień</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestSound}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg theme-surface theme-hover theme-border border theme-text"
                  >
                    Testuj dźwięk
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
                  <span className="text-xs font-semibold theme-text">Wibracja w telefonie</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestVibration}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg theme-surface theme-hover theme-border border theme-text"
                  >
                    Testuj wibrację
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
                  <h4 className="text-sm font-bold theme-text">Lokalny Asystent Kalendarza</h4>
                  <p className="text-xs theme-muted">100% Offline NLP • 0 telemetrii</p>
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
              Asystent działa w całości na Twoim telefonie bez żadnego połączenia z internetem. Potrafi analizować wolny czas, planować spotkania ze zdań w języku polskim oraz tworzyć inteligentne podsumowania.
            </p>
          </div>

          {/* Section 5: Blokada kodem PIN */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold theme-text">Blokada kodem PIN</h4>
                  <p className="text-xs theme-muted">Zabezpiecz kalendarz 4-cyfrowym kodem</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.security.pinEnabled}
                  onChange={(e) => handleTogglePin(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-500/30 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 theme-muted" />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Wpisz 4 cyfry (np. 1234)"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-9 pr-3 py-2 rounded-xl theme-input text-xs tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                >
                  Zapisz PIN
                </button>
              </div>

              {pinError && <p className="text-[11px] text-rose-500 font-semibold">{pinError}</p>}
              {pinSuccess && <p className="text-[11px] text-emerald-500 font-semibold">{pinSuccess}</p>}
            </div>
          </div>

          {/* Section 6: Polskie święta i dni ustawowo wolne od pracy */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                <Flag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">Polskie święta i dni wolne</h4>
                <p className="text-xs theme-muted">Oficjalne dni ustawowo wolne od pracy (Nowy Rok, Majówka, Boże Ciało...)</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl theme-subtle theme-border border space-y-2">
              <p className="text-xs theme-text leading-relaxed">
                Możesz jednym kliknięciem zaimportować do swojego kalendarza wszystkie oficjalne polskie święta na lata 2025, 2026 i 2027 (w tym automatycznie wyliczone święta ruchome).
              </p>

              <button
                type="button"
                onClick={() => {
                  const holidays = generateHolidayEvents([2025, 2026, 2027]);
                  onImportEvents(holidays);
                  setHolidaysAdded(true);
                  setTimeout(() => setHolidaysAdded(false), 4000);
                }}
                className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2"
              >
                <Flag className="w-3.5 h-3.5" />
                {holidaysAdded ? 'Dodano polskie święta do kalendarza!' : 'Dodaj polskie święta (2025–2027)'}
              </button>
            </div>
          </div>

          {/* Section 7: Aplikacja na komputer i telefon (APK, Linux, Windows) */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">Aplikacja na telefon i komputer</h4>
                <p className="text-xs theme-muted">Instrukcje i skrypty budowania APK, Linux (.AppImage) i Windows (.exe)</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl theme-subtle theme-border border space-y-2">
              <p className="text-xs theme-text leading-relaxed">
                Przygotowałem skrypty 1-kliknięcia (<code>build-apk.sh</code>, <code>build-desktop.sh</code>, <code>build-windows.bat</code>), dzięki którym łatwo skompilujesz lub uruchomisz program w oknie na CachyOS/Linux, Windowsie i telefonie.
              </p>

              {onOpenBuildGuide && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBuildGuide();
                  }}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Otwórz centrum budowania (APK / Linux / Windows)
                </button>
              )}
            </div>
          </div>

          {/* Section 8: Kopia zapasowa i zarządzanie danymi */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold theme-text">Kopia zapasowa i dane</h4>
                <p className="text-xs theme-muted">Zapisane lokalnie wydarzenia: <strong>{events.length}</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => exportEventsToICS(events)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl theme-subtle theme-hover theme-border border text-xs font-semibold theme-text transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 opacity-70" />
                Pobierz plik .ics
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl theme-subtle theme-hover theme-border border text-xs font-semibold theme-text transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 opacity-70" />
                Wczytaj plik .ics
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".ics,text/calendar"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {importStatus && (
              <p className="text-xs text-blue-400 font-semibold">{importStatus}</p>
            )}

            <div className="pt-2">
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Wyczyść wszystkie wydarzenia
                </button>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    Czy na pewno chcesz usunąć wszystkie {events.length} wydarzeń?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllEvents();
                        setConfirmClear(false);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Tak, usuń wszystko
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-1.5 theme-subtle theme-hover theme-border border theme-text rounded-xl text-xs font-medium transition-colors"
                    >
                      Anuluj
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
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
