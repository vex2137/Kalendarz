import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CalendarDevice } from '../utils/nativeDevice';
import { tr, type AppLanguage } from '../utils/i18n';
import { readSystemNotificationState, requestNotificationPermission, scheduleNativeReminders, type SystemNotificationState } from '../utils/notifications';
import type { CalendarEvent } from '../types';

export function SystemNotificationSettings({ language, events }: { language: AppLanguage; events: CalendarEvent[] }) {
  const [state, setState] = useState<SystemNotificationState | 'checking'>('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const android = Capacitor.getPlatform() === 'android';
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await readSystemNotificationState();
      if (mounted.current && current === revision.current) { setState(next); setError(''); }
      if (mounted.current && current === revision.current && Capacitor.isNativePlatform() && (next === 'enabled' || next === 'silent')) {
        await scheduleNativeReminders(eventsRef.current);
      }
    } catch {
      if (mounted.current && current === revision.current) setState('unknown');
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const listener = android ? CalendarDevice.addListener('notificationSettingsChanged', () => void refresh()) : null;
    void listener?.catch(() => {});
    return () => {
      mounted.current = false;
      ++revision.current;
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      void listener?.then(handle => handle.remove()).catch(() => {});
    };
  }, [android, refresh]);
  const messages = {
    checking: tr(language, 'Sprawdzanie powiadomień…', 'Checking notifications…'),
    enabled: tr(language, 'Powiadomienia systemowe włączone', 'System notifications enabled'),
    silent: tr(language, 'Kategoria przypomnień jest wyciszona w Androidzie', 'The reminder category is silent in Android'),
    blocked: tr(language, 'Powiadomienia systemowe są zablokowane', 'System notifications are blocked'),
    'permission-required': tr(language, 'Powiadomienia wymagają zgody', 'Notification permission is required'),
    unsupported: tr(language, 'Ta przeglądarka nie obsługuje powiadomień systemowych', 'This browser does not support system notifications'),
    unknown: tr(language, 'Nie udało się sprawdzić stanu powiadomień', 'Could not check notification status'),
  };
  async function act() {
    setBusy(true);
    setError('');
    try {
      if (android && (state === 'silent' || state === 'blocked' || state === 'enabled')) {
        await CalendarDevice.openNotificationSettings();
      } else if (state === 'permission-required') {
        await requestNotificationPermission();
        await refresh();
      } else await refresh();
    } catch {
      setError(tr(language, 'Nie udało się zmienić ustawień powiadomień', 'Could not change notification settings'));
    } finally { if (mounted.current) setBusy(false); }
  }
  return <div className="p-3 space-y-2 theme-subtle text-xs" data-testid="system-notifications">
    <p role="status">{messages[state]}</p>
    {state !== 'unsupported' && state !== 'checking' && <button type="button" className="underline" disabled={busy} onClick={() => void act()}>
      {android && (state === 'silent' || state === 'blocked' || state === 'enabled')
        ? tr(language, 'Otwórz ustawienia powiadomień Androida', 'Open Android notification settings')
        : state === 'permission-required' ? tr(language, 'Włącz powiadomienia systemowe', 'Enable system notifications')
        : tr(language, 'Sprawdź ponownie', 'Check again')}
    </button>}
    {!android && state === 'blocked' && <p>{tr(language, 'Zezwól na powiadomienia w ustawieniach witryny w przeglądarce.', 'Allow notifications in your browser’s site settings.')}</p>}
    <p>{tr(language, 'W przeglądarce przypomnienia wymagają działającej aplikacji. Android może planować je systemowo.', 'Browser reminders require the app to be running. Android can schedule them with the system.')}</p>
    {state === 'enabled' && <p>{tr(language, 'Dźwięk zależy też od głośności telefonu i trybu Nie przeszkadzać.', 'Sound also depends on your phone volume and Do Not Disturb mode.')}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
