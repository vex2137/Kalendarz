import { CalendarEvent, AppSettings, GoogleCalendarColor } from '../types';
import { DEFAULT_APP_SETTINGS } from './constants';

const EVENTS_STORAGE_KEY = 'offline_calendar_events_v1';
const SETTINGS_STORAGE_KEY = 'offline_calendar_settings_v1';

// Initial sample events for calendar demo
const getInitialEvents = (): CalendarEvent[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tYear = tomorrow.getFullYear();
  const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tDay = String(tomorrow.getDate()).padStart(2, '0');

  const in3Days = new Date(now);
  in3Days.setDate(now.getDate() + 3);
  const d3Year = in3Days.getFullYear();
  const d3Month = String(in3Days.getMonth() + 1).padStart(2, '0');
  const d3Day = String(in3Days.getDate()).padStart(2, '0');

  return [
    {
      id: 'event-1',
      title: 'Spotkanie projektowe kalendarza',
      description: 'Omówienie funkcji AI offline, powiadomień oraz eksportu do APK.',
      location: 'Gabinet / Offline',
      startDate: `${year}-${month}-${day}`,
      startTime: '10:00',
      endDate: `${year}-${month}-${day}`,
      endTime: '11:30',
      allDay: false,
      color: 'peacock',
      recurrence: 'NONE',
      reminders: [15, 30],
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: 'event-2',
      title: 'Trening biegowy / Siłownia',
      description: 'Rozgrzewka i 5km bieg w terenie.',
      location: 'Park Miejski',
      startDate: `${year}-${month}-${day}`,
      startTime: '17:00',
      endDate: `${year}-${month}-${day}`,
      endTime: '18:15',
      allDay: false,
      color: 'sage',
      recurrence: 'WEEKLY',
      reminders: [30],
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 7200000,
    },
    {
      id: 'event-3',
      title: 'Wizyta u dentysty (Przegląd)',
      description: 'Kontrola okresowa i higienizacja.',
      location: 'Klinika Stomatologiczna, ul. Medyczna 4',
      startDate: `${tYear}-${tMonth}-${tDay}`,
      startTime: '14:30',
      endDate: `${tYear}-${tMonth}-${tDay}`,
      endTime: '15:15',
      allDay: false,
      color: 'tomato',
      recurrence: 'NONE',
      reminders: [60, 1440],
      createdAt: Date.now() - 10000000,
      updatedAt: Date.now() - 10000000,
    },
    {
      id: 'event-4',
      title: 'Dzień wolny - Odpoczynek',
      description: 'Całodniowy relaks i odcięcie od powiadomień.',
      startDate: `${d3Year}-${d3Month}-${d3Day}`,
      endDate: `${d3Year}-${d3Month}-${d3Day}`,
      allDay: true,
      color: 'banana',
      recurrence: 'NONE',
      reminders: [1440],
      createdAt: Date.now() - 15000000,
      updatedAt: Date.now() - 15000000,
    }
  ];
};

export const loadStoredEvents = (): CalendarEvent[] => {
  try {
    const raw = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) {
      const initial = getInitialEvents();
      saveStoredEvents(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load events from storage', err);
    return getInitialEvents();
  }
};

export const saveStoredEvents = (events: CalendarEvent[]): void => {
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('Failed to save events to storage', err);
  }
};

export const loadStoredSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to load settings', err);
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveStoredSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
};

// 100% Offline ICS (iCalendar) Generator & Exporter
export const exportEventsToICS = (events: CalendarEvent[]): void => {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const formatICSDate = (dateStr: string, timeStr?: string, isAllDay = false): string => {
    const cleanDate = dateStr.replace(/-/g, '');
    if (isAllDay || !timeStr) {
      return `VALUE=DATE:${cleanDate}`;
    }
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kalendarz AI Offline//Google Style Calendar//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kalendarz AI Offline',
    'X-WR-TIMEZONE:Europe/Warsaw'
  ];

  events.forEach((ev) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@offline-calendar.local`);
    lines.push(`DTSTAMP:${new Date(ev.createdAt || Date.now()).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    
    if (ev.allDay) {
      lines.push(`DTSTART;${formatICSDate(ev.startDate, undefined, true)}`);
      // In ICS allDay end date is exclusive
      const nextDay = new Date(ev.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;
      lines.push(`DTEND;VALUE=DATE:${nextDayStr}`);
    } else {
      lines.push(`DTSTART:${formatICSDate(ev.startDate, ev.startTime || '09:00')}`);
      lines.push(`DTEND:${formatICSDate(ev.endDate || ev.startDate, ev.endTime || '10:00')}`);
    }

    lines.push(`SUMMARY:${ev.title.replace(/\n/g, ' ')}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`);
    }
    if (ev.location) {
      lines.push(`LOCATION:${ev.location.replace(/\n/g, ' ')}`);
    }

    if (ev.color) {
      lines.push(`COLOR:${ev.color}`);
      lines.push(`X-COLOR:${ev.color}`);
      lines.push(`CATEGORIES:${ev.color}`);
    }

    if (ev.recurrence && ev.recurrence !== 'NONE') {
      lines.push(`RRULE:FREQ=${ev.recurrence}`);
    }

    // Alarm / reminders
    ev.reminders?.forEach((min) => {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Przypomnienie: ${ev.title}`);
      lines.push(`TRIGGER:-PT${min}M`);
      lines.push('END:VALARM');
    });

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const icsData = lines.join('\r\n');

  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `kalendarz-offline-backup-${new Date().toISOString().slice(0, 10)}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 100% Offline ICS Parser
export const parseICSToEvents = (icsText: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  
  let currentEvent: Partial<CalendarEvent> | null = null;
  let inValarm = false;
  let currentAlarmTrigger = 15;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        id: 'imported-' + Math.random().toString(36).substring(2, 9),
        title: 'Bez tytułu',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        allDay: false,
        color: 'peacock',
        recurrence: 'NONE',
        reminders: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      continue;
    }

    if (line === 'END:VEVENT' && currentEvent) {
      if (!currentEvent.reminders || currentEvent.reminders.length === 0) {
        currentEvent.reminders = [15];
      }
      events.push(currentEvent as CalendarEvent);
      currentEvent = null;
      continue;
    }

    if (line === 'BEGIN:VALARM') {
      inValarm = true;
      continue;
    }
    if (line === 'END:VALARM') {
      inValarm = false;
      if (currentEvent && currentAlarmTrigger !== undefined) {
        currentEvent.reminders = [...(currentEvent.reminders || []), currentAlarmTrigger];
      }
      continue;
    }

    if (inValarm && line.startsWith('TRIGGER:')) {
      const match = line.match(/PT(\d+)M/);
      if (match) {
        currentAlarmTrigger = parseInt(match[1], 10);
      }
      continue;
    }

    if (!currentEvent) continue;

    if (line.startsWith('SUMMARY:')) {
      currentEvent.title = line.substring(8);
    } else if (line.startsWith('DESCRIPTION:')) {
      currentEvent.description = line.substring(12).replace(/\\n/g, '\n');
    } else if (line.startsWith('LOCATION:')) {
      currentEvent.location = line.substring(9);
    } else if (line.startsWith('COLOR:') || line.startsWith('X-COLOR:') || line.startsWith('CATEGORIES:')) {
      const colorVal = line.split(':')[1]?.trim().toLowerCase();
      const validColors: GoogleCalendarColor[] = ['tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil', 'peacock', 'blueberry', 'lavender', 'grape', 'graphite'];
      if (validColors.includes(colorVal as GoogleCalendarColor)) {
        currentEvent.color = colorVal as GoogleCalendarColor;
      }
    } else if (line.startsWith('DTSTART')) {
      const val = line.split(':')[1];
      if (val) {
        if (val.length === 8) {
          // YYYYMMDD
          currentEvent.allDay = true;
          currentEvent.startDate = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
        } else if (val.length >= 13) {
          currentEvent.startDate = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
          currentEvent.startTime = `${val.substring(9, 11)}:${val.substring(11, 13)}`;
        }
      }
    } else if (line.startsWith('DTEND')) {
      const val = line.split(':')[1];
      if (val) {
        if (val.length === 8) {
          currentEvent.endDate = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
        } else if (val.length >= 13) {
          currentEvent.endDate = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
          currentEvent.endTime = `${val.substring(9, 11)}:${val.substring(11, 13)}`;
        }
      }
    } else if (line.startsWith('RRULE:')) {
      if (line.includes('FREQ=DAILY')) currentEvent.recurrence = 'DAILY';
      else if (line.includes('FREQ=WEEKLY')) currentEvent.recurrence = 'WEEKLY';
      else if (line.includes('FREQ=MONTHLY')) currentEvent.recurrence = 'MONTHLY';
      else if (line.includes('FREQ=YEARLY')) currentEvent.recurrence = 'YEARLY';
    }
  }

  return events;
};
