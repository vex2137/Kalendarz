import React, { useState, useRef } from 'react';
import { 
  AppSettings, 
  CalendarEvent 
} from '../types';
import { 
  exportEventsToICS, 
  parseICSToEvents 
} from '../utils/storage';
import { 
  playNotificationSound, 
  triggerVibration, 
  requestNotificationPermission 
} from '../utils/notifications';
import { 
  X, 
  Cpu, 
  Lock, 
  Bell, 
  Download, 
  Upload, 
  Trash2, 
  Volume2, 
  Check, 
  AlertTriangle,
  Smartphone
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  events: CalendarEvent[];
  onImportEvents: (newEvents: CalendarEvent[]) => void;
  onClearAllEvents: () => void;
  onLockApp: () => void;
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
}) => {
  const [pinInput, setPinInput] = useState(settings.security.pinCode || '');
  const [showPinError, setShowPinError] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleToggleAi = (enabled: boolean) => {
    onUpdateSettings({
      ...settings,
      ai: {
        ...settings.ai,
        enabled,
      },
    });
  };

  const handleTogglePin = (enabled: boolean) => {
    if (enabled && pinInput.length < 4) {
      setShowPinError(true);
      return;
    }
    setShowPinError(false);
    onUpdateSettings({
      ...settings,
      security: {
        ...settings.security,
        pinEnabled: enabled,
        pinCode: enabled ? pinInput : '',
      },
    });
  };

  const handleSavePin = () => {
    if (pinInput.length !== 4 || !/^\d+$/.test(pinInput)) {
      setShowPinError(true);
      return;
    }
    setShowPinError(false);
    onUpdateSettings({
      ...settings,
      security: {
        ...settings.security,
        pinEnabled: true,
        pinCode: pinInput,
      },
    });
  };

  const handleRequestPush = async () => {
    const res = await requestNotificationPermission();
    setNotificationStatus(res);
  };

  const handleTestChime = () => {
    playNotificationSound();
    triggerVibration();
  };

  const handleIcsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      } catch (err) {
        setImportStatus('Błąd podczas odczytu pliku .ics');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="modal-settings"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <h3 className="text-base font-semibold text-stone-900">Ustawienia kalendarza</h3>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh] divide-y divide-stone-100">
          {/* Section 1: Local AI Engine (Gemma 2 2B) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">Lokalny model AI</h4>
                  <p className="text-xs text-stone-700">Działający w 100% na urządzeniu</p>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-ai-enabled"
                  type="checkbox"
                  checked={settings.ai.enabled}
                  onChange={(e) => handleToggleAi(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {settings.ai.enabled ? (
              <div className="p-3 bg-violet-50/60 rounded-xl border border-violet-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-violet-900">
                  <span className="font-medium">Aktywny silnik:</span>
                  <span className="font-semibold px-2 py-0.5 rounded-md bg-violet-200 text-violet-950">
                    Gemma 2 (2B) On-Device
                  </span>
                </div>
                <p className="text-[11px] text-stone-700">
                  Przetwarzanie tekstu, rozpoznawanie dat w języku polskim oraz asystent czatu działają bezpośrednio na procesorze telefonu bez wysyłania jakichkolwiek zapytań do internetu.
                </p>
              </div>
            ) : (
              <div className="p-2.5 bg-stone-100 rounded-xl text-xs text-stone-700">
                Sztuczna inteligencja jest wyłączona. Wszystkie standardowe funkcje kalendarza działają normalnie.
              </div>
            )}
          </div>

          {/* Section 2: Security & PIN lock */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">Blokada kodem PIN</h4>
                  <p className="text-xs text-stone-700">Ochrona Twojego kalendarza przed niepowołanymi osobami</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-pin-security"
                  type="checkbox"
                  checked={settings.security.pinEnabled}
                  onChange={(e) => handleTogglePin(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {settings.security.pinEnabled && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                <label className="block text-stone-700 font-medium">Ustaw 4-cyfrowy kod PIN:</label>
                <div className="flex items-center gap-2">
                  <input
                    id="input-pin-setting"
                    type="password"
                    maxLength={4}
                    placeholder="np. 1234"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, ''));
                      setShowPinError(false);
                    }}
                    className="w-28 tracking-widest text-center text-sm font-bold px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <button
                    type="button"
                    id="btn-save-pin"
                    onClick={handleSavePin}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium"
                  >
                    Zapisz PIN
                  </button>
                  <button
                    type="button"
                    id="btn-lock-now"
                    onClick={() => {
                      onClose();
                      onLockApp();
                    }}
                    className="px-3 py-1.5 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-lg text-xs font-medium"
                  >
                    Zablokuj teraz
                  </button>
                </div>
                {showPinError && (
                  <p className="text-xs text-red-600">Wpisz dokładnie 4 cyfry.</p>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Notifications & Sounds */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">Dźwięki i Alerty</h4>
                  <p className="text-xs text-stone-700">Powiadomienia przed nadchodzącymi wydarzeniami</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
              <div>
                <span className="font-medium text-stone-800">Dźwięk gongu przypomnienia</span>
                <p className="text-[11px] text-stone-700">Syntetyczny dźwięk Google Calendar (działa offline)</p>
              </div>
              <button
                type="button"
                id="btn-test-sound"
                onClick={handleTestChime}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg text-stone-800 font-medium transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Testuj dźwięk</span>
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
              <div>
                <span className="font-medium text-stone-800">Uprawnienie do powiadomień systemowych</span>
                <p className="text-[11px] text-stone-700">Status: {notificationStatus === 'granted' ? 'Aktywne' : 'Nieaktywne'}</p>
              </div>
              {notificationStatus !== 'granted' ? (
                <button
                  type="button"
                  id="btn-grant-notifications-settings"
                  onClick={handleRequestPush}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Włącz powiadomienia
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="w-4 h-4" />
                  Włączone
                </span>
              )}
            </div>
          </div>

          {/* Section 4: Backup, ICS Import & Export */}
          <div className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-stone-900">Kopia zapasowa i Import</h4>
                <p className="text-xs text-stone-700">Format .ics kompatybilny z Google Calendar</p>
              </div>
            </div>

            {importStatus && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs">
                {importStatus}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                id="btn-export-ics"
                onClick={() => exportEventsToICS(events)}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl font-medium text-stone-800 transition-colors"
              >
                <Download className="w-4 h-4 text-stone-600" />
                <span>Eksportuj (.ics)</span>
              </button>

              <label className="flex items-center justify-center gap-1.5 p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl font-medium text-stone-800 transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-stone-600" />
                <span>Importuj (.ics)</span>
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleIcsFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 5: Android APK Info */}
          <div className="space-y-2 pt-5">
            <div className="flex items-center gap-2 text-stone-900">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold">Generowanie Android APK & ZIP</h4>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed">
              Projekt możesz natychmiast pobrać w formacie <strong>.zip</strong> poprzez menu AI Studio (Export &gt; Download ZIP). Do wygenerowania pliku <code>.apk</code> możesz użyć standardowego polecenia <code>npx cap add android && npx cap build android</code> w Android Studio.
            </p>
          </div>

          {/* Section 6: Reset / Clear */}
          <div className="pt-5">
            <button
              type="button"
              id="btn-clear-all-events"
              onClick={() => {
                if (confirm('Czy na pewno chcesz usunąć wszystkie wydarzenia z lokalnej pamięci?')) {
                  onClearAllEvents();
                  onClose();
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Wyczyść wszystkie wydarzenia</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            id="btn-close-settings-bottom"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};
