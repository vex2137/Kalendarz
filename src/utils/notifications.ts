import { CalendarEvent } from '../types';

let audioCtx: AudioContext | null = null;

export const playNotificationSound = (): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === 'undefined') return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
};

// Tracks which notification keys have already been fired in this session
const firedNotificationKeys = new Set<string>();

export const checkEventReminders = (
  events: CalendarEvent[],
  onTrigger: (event: CalendarEvent, minutesBefore: number) => void
): void => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  events.forEach((ev) => {
    if (ev.startDate !== todayStr || ev.allDay || !ev.startTime) return;

    const [h, m] = ev.startTime.split(':').map(Number);
    const eventTotalMinutes = h * 60 + m;

    (ev.reminders || [15]).forEach((remMinutes) => {
      const targetTriggerMinute = eventTotalMinutes - remMinutes;
      // If current minute equals target minute
      if (currentTotalMinutes === targetTriggerMinute) {
        const key = `${ev.id}_${ev.startDate}_${remMinutes}`;
        if (!firedNotificationKeys.has(key)) {
          firedNotificationKeys.add(key);
          onTrigger(ev, remMinutes);

          // Native system notification if granted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const timeInfo = remMinutes === 0 ? 'Właśnie teraz!' : `Za ${remMinutes} min (${ev.startTime})`;
            new Notification(`📅 ${ev.title}`, {
              body: `${timeInfo}${ev.location ? ` • 📍 ${ev.location}` : ''}`,
              icon: '/icon.svg',
            });
          }
        }
      }
    });
  });
};
