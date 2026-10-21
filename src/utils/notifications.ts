import { getTranslation, tr, type AppLanguage } from './i18n';
import { CalendarEvent } from '../types';
import { Capacitor } from '@capacitor/core';
import { occurrenceDates } from './recurrence';
import { addDays, localDate } from './dates';
import { zonedDateTime } from './timezone';
import { CalendarDevice } from './nativeDevice';

export type SystemNotificationState = 'enabled' | 'silent' | 'blocked' | 'permission-required' | 'unsupported' | 'unknown';

/** Read the OS every time; never infer current permission from saved app settings. */
export async function readSystemNotificationState(): Promise<SystemNotificationState> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission === 'granted' ? 'enabled' : Notification.permission === 'denied' ? 'blocked' : 'permission-required';
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const permission = (await LocalNotifications.checkPermissions())?.display;
  if (permission === 'denied') return 'blocked';
  if (permission === 'prompt' || permission === 'prompt-with-rationale') return 'permission-required';
  if (permission !== 'granted') return 'unknown';
  if (Capacitor.getPlatform() !== 'android') return 'enabled';
  const status = await CalendarDevice.notificationStatus();
  if (status?.enabled === false || status?.channel === 'blocked') return 'blocked';
  if (status?.enabled !== true) return 'unknown';
  if (status.channel === 'silent') return 'silent';
  return status.channel === 'ready' ? 'enabled' : 'unknown';
}

let audioCtx: AudioContext | null = null;

export const playNotificationSound = (): void => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    // Gentle melodic chime: 520Hz -> 659Hz (E5 -> E5+)
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.24); // G5

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.warn('AudioContext playback error:', err);
  }
};

export const triggerVibration = (pattern: number[] = [100, 50, 100]): void => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch (err) {
    console.warn('Vibration API error:', err);
  }
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import(
      '@capacitor/local-notifications'
    );
    const result = await LocalNotifications.requestPermissions();
    return result?.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
}
export interface DueReminder {
  event: CalendarEvent;
  minutesBefore: number;
  occurrenceDate: string;
  triggerAt: number;
  key: string;
}
export function dueReminders(
  events: CalendarEvent[],
  from: number,
  to: number,
): DueReminder[] {
  const result: DueReminder[] = [];
  for (const event of events) {
    if (event.allDay || !event.startTime) continue;
    for (const reminder of event.reminders) {
      const offset = reminder * 60000;
      const first = addDays(localDate(new Date(from + offset)), -1),
        last = addDays(localDate(new Date(to + offset)), 1);
      for (const date of occurrenceDates(event, first, last)) {
        const triggerAt =
          zonedDateTime(date, event.startTime, event.timeZone).getTime() -
          offset;
        if (triggerAt > from && triggerAt <= to)
          result.push({
            event,
            minutesBefore: reminder,
            occurrenceDate: date,
            triggerAt,
            key: `${event.id}:${date}:${event.startTime}:${reminder}`,
          });
      }
    }
  }
  return result.sort((a, b) => a.triggerAt - b.triggerAt);
}
let fired: Record<string, number> | undefined;
export function checkEventReminders(
  events: CalendarEvent[],
  onTrigger: (event: CalendarEvent, minutesBefore: number) => void,
  now = new Date(),
  since = now.getTime() - 60000,
  showSystem = true,
): void {
  const at = now.getTime();
  try {
    fired = {
      ...fired,
      ...JSON.parse(localStorage.getItem('offline_calendar_fired') || '{}'),
    };
  } catch {
    fired ||= {};
  }
  fired ||= {};
  for (const [key, time] of Object.entries(fired))
    if (time < at - 3 * 86400000) delete fired[key];
  // Catch up after sleep, without replaying days of historical notifications.
  for (const due of dueReminders(events, Math.max(since, at - 86400000), at)) {
    if (fired[due.key]) continue;
    fired[due.key] = at;
    onTrigger(due.event, due.minutesBefore);
    if (
      !Capacitor.isNativePlatform() &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const language = (document.documentElement.lang || 'en') as AppLanguage;
      const notificationTitle = showSystem ? due.event.title : getTranslation(language).appName;
      const text = !showSystem ? tr(language, 'Przypomnienie', 'Reminder') : tr(language, `Początek o ${due.event.startTime}`, `Starts at ${due.event.startTime}`);
      try {
        new Notification(notificationTitle, {
          body: text,
          icon: './icon.svg',
          tag: due.key,
        });
      } catch {
        // Mobile browsers require the service worker notification API.
        void navigator.serviceWorker?.ready
          .then((reg) =>
            reg.showNotification(notificationTitle, {
              body: text,
              icon: './icon.svg',
              tag: due.key,
            }),
          )
          .catch(() => {});
      }
    }
  }
  try {
    localStorage.setItem('offline_calendar_fired', JSON.stringify(fired));
  } catch {
    /* Notification deduplication must not interrupt the calendar. */
  }
}
async function replaceNativeReminders(events: CalendarEvent[], locked = false) {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if ((await LocalNotifications.checkPermissions())?.display !== 'granted')
    return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel(pending);
  const at = Date.now();
  const upcoming = dueReminders(events, at, at + 7 * 86400000).slice(0, 64);
  if (upcoming.length)
    await LocalNotifications.schedule({
      notifications: upcoming.map((due, index) => ({
        id: index + 1,
        title: locked ? getTranslation((typeof document !== 'undefined' ? document.documentElement.lang : 'en') as AppLanguage).appName : due.event.title,
        body: locked ? 'Przypomnienie / Reminder' : due.event.startTime!,
        schedule: { at: new Date(due.triggerAt) },
        extra: { key: due.key },
      })),
    });
}

let nativeQueue: Promise<void> = Promise.resolve();
export function scheduleNativeReminders(
  events: CalendarEvent[],
  locked = false,
) {
  nativeQueue = nativeQueue
    .catch(() => {})
    .then(() => replaceNativeReminders(events, locked));
  return nativeQueue;
}
