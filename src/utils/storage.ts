import { CalendarEvent, AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from './constants';
import { generateHolidayEvents } from './holidays';

const STORAGE_KEY_EVENTS = 'offline_calendar_events_v2';
const STORAGE_KEY_SETTINGS = 'offline_calendar_settings_v2';

export const loadStoredEvents = (): CalendarEvent[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) {
      // Seed default Polish holidays for 2026–2031 on first load
      const initialHolidays = generateHolidayEvents([2026, 2027, 2028, 2029, 2030, 2031]);
      saveStoredEvents(initialHolidays);
      return initialHolidays;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load events from localStorage:', err);
    return [];
  }
};

export const saveStoredEvents = (events: CalendarEvent[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch (err) {
    console.warn('Failed to save events to localStorage:', err);
  }
};

export const loadStoredSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      ai: { ...DEFAULT_APP_SETTINGS.ai, ...(parsed.ai || {}) },
      security: { ...DEFAULT_APP_SETTINGS.security, ...(parsed.security || {}) },
    };
  } catch (err) {
    console.warn('Failed to load settings from localStorage:', err);
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveStoredSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings to localStorage:', err);
  }
};

/**
 * Export events to standard iCalendar (.ics) format
 */
export const exportEventsToICS = (events: CalendarEvent[]): void => {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const formatDateToICS = (dateStr: string, timeStr?: string): string => {
    const cleanDate = dateStr.replace(/-/g, '');
    if (!timeStr) return `${cleanDate}`;
    const cleanTime = timeStr.replace(/:/g, '') + '00';
    return `${cleanDate}T${cleanTime}`;
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kalendarz Offline//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((e) => {
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${e.id}@kalendarz.offline`);
    ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`);
    
    if (e.allDay) {
      ics.push(`DTSTART;VALUE=DATE:${formatDateToICS(e.startDate)}`);
      ics.push(`DTEND;VALUE=DATE:${formatDateToICS(e.endDate || e.startDate)}`);
    } else {
      ics.push(`DTSTART:${formatDateToICS(e.startDate, e.startTime || '09:00')}`);
      ics.push(`DTEND:${formatDateToICS(e.endDate || e.startDate, e.endTime || '10:00')}`);
    }

    ics.push(`SUMMARY:${e.title.replace(/\n/g, ' ')}`);
    if (e.description) {
      ics.push(`DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`);
    }
    if (e.location) {
      ics.push(`LOCATION:${e.location.replace(/\n/g, ' ')}`);
    }

    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  const icsContent = ics.join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kalendarz_export_${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Parses iCalendar (.ics) text into CalendarEvents
 */
export const parseICSToEvents = (icsText: string): CalendarEvent[] => {
  const lines = icsText.split(/\r\n|\n|\r/);
  const events: CalendarEvent[] = [];
  let currentEvent: Partial<CalendarEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {
        id: 'evt-ics-' + Math.random().toString(36).substring(2, 9),
        title: 'Wydarzenie',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        allDay: true,
        color: 'peacock',
        recurrence: 'NONE',
        reminders: [15],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.startDate) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8).replace(/\\,/g, ',').replace(/\\n/g, ' ');
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9).replace(/\\,/g, ',');
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).replace(/\\n/g, '\n').replace(/\\,/g, ',');
      } else if (line.startsWith('DTSTART')) {
        const value = line.split(':')[1] || '';
        if (value.includes('T')) {
          const [dStr, tStr] = value.split('T');
          currentEvent.startDate = `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
          currentEvent.startTime = `${tStr.substring(0, 2)}:${tStr.substring(2, 4)}`;
          currentEvent.allDay = false;
        } else {
          currentEvent.startDate = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
          currentEvent.allDay = true;
        }
      } else if (line.startsWith('DTEND')) {
        const value = line.split(':')[1] || '';
        if (value.includes('T')) {
          const [dStr, tStr] = value.split('T');
          currentEvent.endDate = `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
          currentEvent.endTime = `${tStr.substring(0, 2)}:${tStr.substring(2, 4)}`;
        } else {
          currentEvent.endDate = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
        }
      }
    }
  }

  return events;
};
