export type GoogleCalendarColor = 
  | 'tomato'      // #d50000
  | 'flamingo'    // #e67c73
  | 'tangerine'   // #f4511e
  | 'banana'      // #f6bf26
  | 'sage'        // #33b679
  | 'basil'       // #0b8043
  | 'peacock'     // #039be5
  | 'blueberry'   // #3f51b5
  | 'lavender'    // #7986cb
  | 'grape'       // #8e24aa
  | 'graphite';   // #616161

export interface CalendarColorDef {
  id: GoogleCalendarColor;
  name: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export type RecurrenceFreq = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';

export interface CustomRecurrenceRule {
  interval: number; // e.g. 1, 2, 3...
  unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  daysOfWeek?: number[]; // [0, 1, 2, 3, 4, 5, 6] (0 = Sunday, 1 = Monday ...)
  endType: 'NEVER' | 'UNTIL_DATE' | 'COUNT';
  untilDate?: string; // YYYY-MM-DD
  count?: number; // total occurrences
}

export type ReminderInterval = 0 | 5 | 10 | 15 | 30 | 60 | 120 | 1440 | 'custom'; // minutes before

export interface ReminderSetting {
  id: string;
  minutesBefore: number;
  label: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (empty if allDay)
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  allDay: boolean;
  color: GoogleCalendarColor;
  recurrence: RecurrenceFreq;
  customRecurrence?: CustomRecurrenceRule;
  reminders: number[]; // minutes before event
  isCompletedTask?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda' | 'year';

export interface AiSettings {
  enabled: boolean;
  model: 'gemma-2-2b-local' | 'lightweight-nlp';
  autoExtractEvents: boolean;
  temperature: number;
  modelLoaded: boolean;
  downloadProgress: number; // 0 - 100%
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pinCode: string;
  autoLockMinutes: number;
  isLocked: boolean;
}

export type AppTheme = 'light' | 'dark' | 'nord' | 'emerald' | 'sunset' | 'lavender' | 'moka';

import { AppLanguage } from './utils/i18n';

export interface AppSettings {
  language?: AppLanguage;
  ai: AiSettings;
  security: SecuritySettings;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  startOfWeek: 1; // 1 = Monday
  theme: AppTheme;
  defaultEventDuration: number; // np. 30, 45, 60 minut
  defaultReminder: number; // np. 0, 5, 10, 15, 30, 60 minut
  defaultView: CalendarViewMode;
  defaultColor: GoogleCalendarColor;
  timeFormat24h: boolean;
  compactView: boolean;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  suggestedEvent?: Partial<CalendarEvent>;
  suggestedPrompts?: string[];
}
