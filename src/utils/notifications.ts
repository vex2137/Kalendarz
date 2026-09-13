import { CalendarEvent } from '../types';

let audioCtx: AudioContext | null = null;

export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx = new AudioContextClass();
    }

    const now = audioCtx.currentTime;
    
    // Pleasant Google-like calendar chime (two harmonic tones)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now + 0.1);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Audio chime playback error:', err);
  }
};

export const triggerVibration = (pattern = [100, 50, 100]) => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return await Notification.requestPermission();
};

export const sendLocalNotification = (title: string, body: string) => {
  playNotificationSound();
  triggerVibration();

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
    } catch {
      // If service worker required on mobile
    }
  }
};

export const checkEventReminders = (
  events: CalendarEvent[], 
  onTriggerReminder: (event: CalendarEvent, minutesBefore: number) => void
) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  events.forEach((ev) => {
    if (ev.startDate !== todayStr) return;
    if (ev.allDay || !ev.startTime) return;

    const [h, m] = ev.startTime.split(':').map(Number);
    const eventTotalMinutes = h * 60 + m;

    ev.reminders.forEach((minBefore) => {
      const triggerTimeMinutes = eventTotalMinutes - minBefore;
      // Match exact minute
      if (triggerTimeMinutes === currentMinutes) {
        onTriggerReminder(ev, minBefore);
      }
    });
  });
};
