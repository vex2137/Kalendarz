import { SettingsLayout, SettingsOption } from './SettingsLayout';
import { ShortcutEditor } from './ShortcutEditor';
import { UpdateSettings } from './UpdateSettings';
import { DEFAULT_APP_SETTINGS } from '../utils/constants';
import { p3 } from '../utils/part3Text';
import { featureText } from '../utils/featureCopy';
import { CustomThemeEditor } from './CustomThemeEditor';
import { AnimationSettingsPanel } from './AnimationSettingsPanel';
import { OFFICIAL_THEMES } from '../utils/themes';
import { tr } from '../utils/i18n';
import { SystemNotificationSettings } from './SystemNotificationSettings';
import { planningPreferences } from '../utils/assistantPlanning';
import { reminderLabel, colorLabel } from '../utils/i18n';
import { hashPassword, hashPin, verifyCurrentCredential } from '../utils/security';
import { CalendarDevice } from '../utils/nativeDevice';
import { Capacitor } from '@capacitor/core';
import { MAX_IMPORT_BYTES, validateEvents } from '../utils/validation';
import { downloadFile } from '../utils/storage';
import { Dialog } from './Dialog';
import React, { useState, useRef, useEffect } from 'react';
import {
  AppSettings,
  CalendarEvent,
  GoogleCalendarColor,
  CalendarViewMode,
} from '../types';
import { exportEventsToICS, parseICSToEvents } from '../utils/storage';
import {
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
  initialCategory?: string;
  onOpenSync?: () => void;
  onOpenAi?: () => void;
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => boolean | void;
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
  onUpdateSettings: persistSettings,
  events,
  onImportEvents,
  onRemoveHolidays,
  onClearAllEvents,
  onLockApp,
  initialCategory, onOpenSync, onOpenAi,
}) => {
  const lang: AppLanguage = settings.language || 'en';
  const settingsBack=useRef<()=>boolean>(()=>false);
  const [saveError,setSaveError]=useState(false);
  const onUpdateSettings=(next:AppSettings)=>{
    try{const success=persistSettings(next)!==false;setSaveError(!success);return success;}
    catch{setSaveError(true);return false;}
  };
  const t = getTranslation(lang);
  const planning = planningPreferences(settings.ai.planning);
  const updatePlanning = (patch: Partial<typeof planning>) => onUpdateSettings({ ...settings, ai: { ...settings.ai, planning: { ...planning, ...patch } } });

  const [pinInput, setPinInput] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [holidaysToast, setHolidaysToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    if (isOpen && Capacitor.getPlatform() === 'android') {
      void CalendarDevice.biometricStatus().then(result => { if (active) setBiometricAvailable(result.available); }).catch(() => { if (active) setBiometricAvailable(false); });
    }
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Count Polish holiday events in calendar
  const polishHolidaysInCal = events.filter(
    (e) => e.id.startsWith('pl-holiday-') || e.title.startsWith('🇵🇱 '),
  );

  const handleSavePin = async () => {
    if (!/^\d{4,16}$/.test(pinInput)) {
      setPinError(tr(lang, 'PIN musi zawierać od 4 do 16 cyfr.', 'PIN must contain 4 to 16 digits.'));
      return;
    }
    if (pinInput !== pinConfirmation) {
      setPinError(tr(lang, 'Potwierdzenie PIN-u nie jest zgodne.', 'PIN confirmation does not match.'));
      return;
    }
    if (settings.security.pinEnabled && !(await verifyCurrentCredential(currentPin, settings.security))) {
      setPinError(tr(lang, 'Obecne dane są nieprawidłowe.', 'Current credential is incorrect.'));
      return;
    }
    setPinError(null);
    try {
      const hash = await hashPin(pinInput);
      if (onUpdateSettings({
        ...settings,
        security: { ...settings.security, ...hash, authenticationMethod: 'pin' },
      }) === false) { setPinError(tr(lang, 'Nie zapisano ustawień.', 'Settings were not saved.')); return; }
      setPinInput('');
      setPinConfirmation('');
      setCurrentPin('');
    } catch (error) {
      setPinError(String(error));
      return;
    }
    setPinSuccess(
      tr(lang, 'PIN został zaktualizowany.', 'PIN successfully updated.'),
    );
    setTimeout(() => setPinSuccess(null), 3000);
  };

  const handleTogglePin = async (enabled: boolean) => {
    if (!enabled && !(await verifyCurrentCredential(currentPin, settings.security))) {
      setPinError(tr(lang, 'Wprowadź poprawne obecne dane.', 'Enter the correct current credential.'));
      return;
    }
    const passwordMode = settings.security.authenticationMethod === 'password';
    if (enabled && passwordMode && !settings.security.passwordHash) {
      setPinError(tr(lang, 'Najpierw ustaw hasło.', 'Set a password first.'));
      return;
    }
    if (enabled && !passwordMode && !settings.security.pinHash && !/^\d{4,16}$/.test(pinInput)) {
      setPinError(
        tr(lang, 'Wprowadź PIN składający się z 4–16 cyfr.', 'Enter a PIN of 4–16 digits.'),
      );
      return;
    }
    if (enabled && !passwordMode && pinInput && pinInput !== pinConfirmation) {
      setPinError(tr(lang, 'Potwierdzenie PIN-u nie jest zgodne.', 'PIN confirmation does not match.'));
      return;
    }
    setPinError(null);
    try {
      const hash = enabled && !passwordMode && pinInput ? await hashPin(pinInput) : {};
      if (onUpdateSettings({
        ...settings,
        security: { ...settings.security, ...hash, pinEnabled: enabled, biometricEnabled: enabled ? settings.security.biometricEnabled : false },
      }) === false) { setPinError(tr(lang, 'Nie zapisano ustawień.', 'Settings were not saved.')); return; }
      setPinInput('');
      setPinConfirmation('');
      setCurrentPin('');
    } catch (error) {
      setPinError(String(error));
    }
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (biometricBusy) return;
    if (!settings.security.pinEnabled || !(await verifyCurrentCredential(currentPin, settings.security))) {
      setPinError(tr(lang, 'Wprowadź poprawne obecne dane.', 'Enter the correct current credential.'));
      return;
    }
    setBiometricBusy(true);
    try {
      if (enabled) {
        const result = await CalendarDevice.authenticateBiometric({ title: tr(lang, 'Włącz biometrię', 'Enable biometrics'), cancel: tr(lang, 'Anuluj', 'Cancel') });
        if (result.authenticated !== true) throw new Error('cancelled');
      }
      if (onUpdateSettings({ ...settings, security: { ...settings.security, biometricEnabled: enabled } }) === false) {
        setPinError(tr(lang, 'Nie zapisano ustawień.', 'Settings were not saved.')); return;
      }
      setCurrentPin(''); setPinError(null);
    } catch {
      setPinError(tr(lang, 'Biometria jest niedostępna lub anulowano uwierzytelnianie.', 'Biometrics are unavailable or authentication was cancelled.'));
    } finally { setBiometricBusy(false); }
  };

  const handleSavePassword = async () => {
    if (passwordInput !== passwordConfirmation) {
      setPinError(tr(lang, 'Potwierdzenie hasła nie jest zgodne.', 'Password confirmation does not match.'));
      return;
    }
    if (settings.security.pinEnabled && !(await verifyCurrentCredential(currentPin, settings.security))) {
      setPinError(tr(lang, 'Obecne dane są nieprawidłowe.', 'Current credential is incorrect.'));
      return;
    }
    try {
      const hash = await hashPassword(passwordInput);
      if (onUpdateSettings({ ...settings, security: { ...settings.security, ...hash, authenticationMethod: 'password' } }) === false) {
        setPinError(tr(lang, 'Nie zapisano ustawień.', 'Settings were not saved.')); return;
      }
      setPasswordInput(''); setPasswordConfirmation(''); setCurrentPin(''); setPinError(null);
      setPinSuccess(tr(lang, 'Hasło zostało zapisane.', 'Password saved.'));
    } catch {
      setPinError(tr(lang, 'Hasło musi zawierać od 8 do 64 znaków.', 'Password must contain 8 to 64 characters.'));
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
        tr(lang, 'Plik jest zbyt duży (maks. 10 MB)', 'File too large (max 10 MB)'),
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
            tr(lang, `Pomyślnie zaimportowano ${parsed.length} wydarzeń z pliku .ics!`, `Successfully imported ${parsed.length} events from .ics file!`),
          );
        } else {
          setImportStatus(
            tr(lang, 'Nie znaleziono poprawnych wydarzeń w pliku .ics.', 'No valid events found in .ics file.'),
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
      onBack={()=>{if(!settingsBack.current())onClose();}}
      label={t.settingsTitle}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="modal-settings"
        className="theme-surface theme-text rounded-3xl max-w-6xl w-full shadow-2xl theme-border border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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

        {saveError&&<p role="alert" className="px-4 py-2" data-testid="settings-save-error">{p3(lang,'Could not save')}</p>}
        {/* Content */}
        <SettingsLayout settings={settings} onUpdateSettings={onUpdateSettings} language={lang} initialCategory={initialCategory} backRef={settingsBack}>
<SettingsOption id="language" category="general" title={t.language}>
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
              {([
                { code: 'pl', flag: '🇵🇱', name: 'Polski' },
                { code: 'en', flag: '🇬🇧', name: 'English' },
                { code: 'ru', flag: '🇷🇺', name: 'Русский' },
                { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
              ] as const).map(({ code, flag, name }) => (
                <button key={code} type="button" aria-label={name} aria-pressed={lang === code}
                  onClick={() => onUpdateSettings({ ...settings, language: code })}
                  className={`min-w-0 p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-1 ${
                    lang === code ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 font-bold theme-text' : 'theme-border theme-subtle theme-muted hover:theme-text'
                  }`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-lg" aria-hidden="true">{flag}</span>
                    <span className="text-xs">{name}</span>
                  </span>
                  {lang === code && <Check className="w-4 h-4 shrink-0 text-blue-500" />}
                </button>
              ))}
            </div>
          </div>

</SettingsOption>
<SettingsOption id="themes" category="appearance" title={t.theme}>
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
              {OFFICIAL_THEMES.map(theme => <button key={theme.id} type="button" aria-pressed={settings.theme === theme.id}
                onClick={() => onUpdateSettings({ ...settings, theme: theme.id as AppSettings['theme'] })}
                className="p-3 rounded-2xl border text-left theme-border theme-hover"
                style={{ backgroundColor: theme.colors[1], color: theme.colors[6], borderColor: theme.colors[5] }}>
                <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: theme.colors[8] }} />
                {tr(lang, theme.pl, theme.en)}{settings.theme === theme.id && ' ✓'}
              </button>)}
            </div>
            <label className="block text-xs theme-muted">{tr(lang, 'Wcześniejsze motywy', 'Previous themes')}
              <select className="block w-full theme-input rounded-xl p-2" value={['nord', 'emerald', 'lavender', 'moka'].includes(settings.theme) ? settings.theme : ''}
                onChange={e => { if (e.target.value) onUpdateSettings({ ...settings, theme: e.target.value as AppSettings['theme'] }); }}>
                <option value="">{tr(lang, 'Wybierz wcześniejszy motyw', 'Choose a previous theme')}</option>
                <option value="nord">Nordic Frost</option><option value="emerald">Emerald</option>
                <option value="lavender">Lavender</option><option value="moka">Moka</option>
              </select>
            </label>
          </div>

          <CustomThemeEditor settings={settings} onUpdateSettings={onUpdateSettings} />
<button type="button" className="theme-input rounded p-2" onClick={()=>{if(window.confirm(p3(lang,'Reset these preferences? Saved themes and all other data will remain.')))onUpdateSettings({...settings,theme: DEFAULT_APP_SETTINGS.theme});}}>{p3(lang,'Reset category')}</button>
</SettingsOption>
<SettingsOption id="motion" category="animations" title={p3(lang,'Animations')}>
          <AnimationSettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} language={lang} />

<button type="button" className="theme-input rounded p-2" onClick={()=>{if(window.confirm(p3(lang,'Reset these preferences? Saved themes and all other data will remain.')))onUpdateSettings({...settings,animations: DEFAULT_APP_SETTINGS.animations});}}>{p3(lang,'Reset category')}</button>
</SettingsOption>
<SettingsOption id="calendar" category="calendar" title={p3(lang,'Calendar')}>
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
                  {tr(lang, 'Ułatw szybkie dodawanie terminów', 'Create events faster')}
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
                  <option value={15}>{tr(lang, '15 minut', '15 min')}</option>
                  <option value={30}>{tr(lang, '30 minut', '30 min')}</option>
                  <option value={45}>{tr(lang, '45 minut', '45 min')}</option>
                  <option value={60}>{tr(lang, '1 godzina (60 min)', '1 hour (60 min)')}</option>
                  <option value={90}>{tr(lang, '1.5 godziny (90 min)', '1.5 hours (90 min)')}</option>
                  <option value={120}>{tr(lang, '2 godziny (120 min)', '2 hours (120 min)')}</option>
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
                  {tr(lang, 'Domyślny widok kalendarza:', 'Default calendar view:')}
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
                    {tr(lang, 'Miesiąc', 'Month')}
                  </option>
                  <option value="week">
                    {tr(lang, 'Tydzień', 'Week')}
                  </option>
                  <option value="day">{tr(lang, 'Dzień', 'Day')}</option>
                  <option value="agenda">
                    {tr(lang, 'Harmonogram', 'Schedule')}
                  </option>
                  <option value="year">{tr(lang, 'Rok', 'Year')}</option>
                </select>
              </div>
            </div>
          </div>

</SettingsOption>
<SettingsOption id="notifications" category="calendar" title={tr(lang,'Powiadomienia','Notifications')}>
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
                  {tr(lang, 'Dźwięki powiadomień i wibracja', 'Notification sounds and vibration')}
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

<SystemNotificationSettings language={lang} events={events}/>
</SettingsOption>
<SettingsOption id="assistant" category="ai" title={p3(lang,'AI assistant')}>
          <p className="text-xs theme-muted">{({en:'Manage models and diagnostics in Assistant → AI settings.',pl:'Zarządzaj modelami i diagnostyką w Asystent → Ustawienia AI.',de:'Modelle und Diagnose unter Assistent → KI-Einstellungen verwalten.',ru:'Управляйте моделями и диагностикой в Ассистент → Настройки ИИ.'})[lang]}</p>

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
              {tr(lang, 'Asystent działa w 100% lokalnie na Twoim urządzeniu. Analizuje grafik, wolny czas, wykrywa kolizje i planuje spotkania ze zdań.', 'The assistant runs 100% locally on your device. It analyzes your schedule, checks free time, and extracts events from natural language.')}
            </p>
          </div>

          <fieldset className="space-y-3 py-4 theme-border border-t">
            <legend className="text-sm font-semibold theme-text">{tr(lang, 'Preferencje planowania asystenta', 'Assistant planning preferences')}</legend>
            <div className="flex flex-wrap gap-3">
              <label className="text-xs theme-muted">{tr(lang, 'Od godziny', 'Start time')}
                <input aria-label={tr(lang, 'Początek dnia', 'Day start')} type="time" value={planning.dayStart} max={planning.dayEnd} onChange={e => { if (e.target.value && e.target.value < planning.dayEnd) updatePlanning({ dayStart: e.target.value }); }} className="block theme-surface theme-text p-2 rounded" />
              </label>
              <label className="text-xs theme-muted">{tr(lang, 'Do godziny', 'End time')}
                <input aria-label={tr(lang, 'Koniec dnia', 'Day end')} type="time" value={planning.dayEnd} min={planning.dayStart} onChange={e => { if (e.target.value > planning.dayStart) updatePlanning({ dayEnd: e.target.value }); }} className="block theme-surface theme-text p-2 rounded" />
              </label>
              <label className="text-xs theme-muted">{tr(lang, 'Przerwa między wydarzeniami (min)', 'Buffer between events (min)')}
                <input type="number" min="0" max="180" value={planning.bufferMinutes} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 180) updatePlanning({ bufferMinutes: value }); }} className="block w-24 theme-surface theme-text p-2 rounded" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 0].map((day, i) => <label key={day} className="flex gap-1 items-center text-xs theme-text">
                <input type="checkbox" checked={planning.workingDays.includes(day)} onChange={e => updatePlanning({ workingDays: e.target.checked ? [...planning.workingDays, day] : planning.workingDays.filter(d => d !== day) })} />
                {(tr(lang, ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))[i]}
              </label>)}
            </div>
            <p className="text-xs theme-muted">{tr(lang, 'Dotyczy propozycji asystenta i wolnych okienek. Nie zmienia istniejących wydarzeń.', 'Used for assistant suggestions and free slots. Existing events are not changed.')}</p>
          </fieldset>

<button type="button" className="theme-primary rounded p-3" onClick={onOpenAi}>{p3(lang,'AI assistant')}</button>
</SettingsOption>
<SettingsOption id="credentials" category="security" title={p3(lang,'Security')}>
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
                      {tr(lang, 'Blokada ekranu nie szyfruje wydarzeń.', 'The screen lock does not encrypt your events.')}
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
                    {tr(lang, 'Ustaw kod PIN (4–16 cyfr):', 'Set a PIN (4–16 digits):')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    aria-label="PIN"
                    autoComplete="new-password"
                    inputMode="numeric"
                    maxLength={16}
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
                    {tr(lang, 'Zapisz PIN', 'Save PIN')}
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
                      {tr(lang, 'Zablokuj teraz', 'Lock now')}
                    </button>
                  )}
                </div>

                <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={16}
                  aria-label={tr(lang, 'Potwierdź nowy PIN', 'Confirm new PIN')}
                  placeholder={tr(lang, 'Potwierdź nowy PIN', 'Confirm new PIN')}
                  value={pinConfirmation} onChange={e => setPinConfirmation(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-1.5 rounded-xl theme-input" />
                {settings.security.pinEnabled && <input type="password" inputMode={settings.security.authenticationMethod === 'password' ? 'text' : 'numeric'} autoComplete="current-password" maxLength={64}
                  aria-label={settings.security.authenticationMethod === 'password' ? tr(lang, 'Obecne hasło', 'Current password') : tr(lang, 'Obecny PIN', 'Current PIN')}
                  placeholder={settings.security.authenticationMethod === 'password' ? tr(lang, 'Obecne hasło', 'Current password') : tr(lang, 'Obecny PIN (do zmiany lub wyłączenia)', 'Current PIN (to change or disable)')}
                  value={currentPin} onChange={e => setCurrentPin(settings.security.authenticationMethod === 'password' ? e.target.value : e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-1.5 rounded-xl theme-input" />}

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold theme-text">{tr(lang, 'Hasło (8–64 znaków)', 'Password (8–64 characters)')}</p>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} aria-label={tr(lang, 'Nowe hasło', 'New password')} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full px-3 py-1.5 rounded-xl theme-input" />
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} aria-label={tr(lang, 'Potwierdź hasło', 'Confirm password')} value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} className="w-full px-3 py-1.5 rounded-xl theme-input" />
                  <label className="flex items-center gap-2 text-xs theme-text"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />{tr(lang, 'Pokaż hasło', 'Show password')}</label>
                  <button type="button" onClick={handleSavePassword} className="px-3 py-1.5 theme-primary rounded-xl text-xs font-bold">{tr(lang, 'Zapisz hasło', 'Save password')}</button>
                </div>
                {Capacitor.getPlatform() === 'android' && <label className="flex items-center gap-2 text-xs theme-text">
                  <input type="checkbox" checked={!!settings.security.biometricEnabled} disabled={!settings.security.pinEnabled || biometricBusy || (!biometricAvailable && !settings.security.biometricEnabled)} onChange={e => void toggleBiometric(e.target.checked)} />
                  {tr(lang, 'Odblokowanie biometryczne', 'Biometric unlock')}
                  {!biometricAvailable && <span>{tr(lang, '(niedostępne)', '(unavailable)')}</span>}
                </label>}

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

</SettingsOption>
<SettingsOption id="holidays" category="calendar" title={t.holidaysSection}>
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
                    className="w-full py-2 rounded-xl theme-primary bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2"
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

</SettingsOption>
<SettingsOption id="autolock" category="security" title={p3(lang,'Security')}>
          <label className="block text-xs theme-muted">
            {tr(lang, 'Automatyczna blokada po minutach bezczynności', 'Auto-lock after minutes of inactivity')}{' '}
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
</SettingsOption>
<SettingsOption id="backup" category="data" title={t.backupAndData}>
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
                  {tr(lang, 'Lokalne wydarzenia:', 'Local events:')}{' '}
                  <strong>{events.length}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs theme-muted">
              {tr(lang, 'Import scala wydarzenia z obecnym kalendarzem. JSON zachowuje wszystkie dane wydarzeń.', 'Import merges events with your calendar. JSON preserves all event fields.')}
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
              {tr(lang, 'Pełna kopia wydarzeń JSON', 'Full event backup (JSON)')}
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
          </div><button type="button" className="theme-primary rounded p-3" onClick={onOpenSync}>{p3(lang,'Data and sync')}</button>
</SettingsOption>
<SettingsOption id="desktop" category="general" title={p3(lang,'Desktop sidebar')}>
<label className="flex gap-2 items-center"><input type="checkbox" checked={settings.desktop?.sidebar??false} onChange={e=>onUpdateSettings({...settings,desktop:{sidebar:e.target.checked,width:settings.desktop?.width??256}})}/>{p3(lang,'Desktop sidebar')}</label>
<label className="block">{p3(lang,'Panel width')}<input aria-label={p3(lang,'Panel width')} type="range" min="220" max="360" step="10" value={settings.desktop?.width??256} onChange={e=>onUpdateSettings({...settings,desktop:{sidebar:settings.desktop?.sidebar??false,width:Number(e.target.value)}})}/></label>
</SettingsOption>
<SettingsOption id="shortcuts" category="shortcuts" title={p3(lang,'Keyboard shortcuts')}><ShortcutEditor settings={settings} onUpdateSettings={onUpdateSettings} language={lang}/></SettingsOption>
<SettingsOption id="sync-security" category="security" title={featureText(lang,'Protect with password')}><p className="text-xs theme-muted">{featureText(lang,'Password protection is optional. Share protected-code passwords separately. JSON exports are not encrypted.')}</p><button type="button" className="theme-input rounded p-3" onClick={onOpenSync}>{featureText(lang,'Protect with password')}</button></SettingsOption>
<SettingsOption id="updates" category="updates" title={p3(lang,'Updates and about')}><UpdateSettings language={lang} autoCheck={initialCategory==='updates'}/></SettingsOption>
        </SettingsLayout>

        {/* Footer */}
        <div className="px-5 py-3 theme-subtle theme-border border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl theme-primary bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
