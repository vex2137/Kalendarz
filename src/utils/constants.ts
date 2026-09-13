import { CalendarColorDef, GoogleCalendarColor, AppSettings } from '../types';

export const GOOGLE_CALENDAR_COLORS: Record<GoogleCalendarColor, CalendarColorDef> = {
  tomato: {
    id: 'tomato',
    name: 'Pomidor',
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-700',
    dot: '#d50000',
  },
  flamingo: {
    id: 'flamingo',
    name: 'Flaming',
    bg: 'bg-rose-400',
    text: 'text-white',
    border: 'border-rose-500',
    dot: '#e67c73',
  },
  tangerine: {
    id: 'tangerine',
    name: 'Mandarynka',
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-orange-700',
    dot: '#f4511e',
  },
  banana: {
    id: 'banana',
    name: 'Banan',
    bg: 'bg-amber-400',
    text: 'text-stone-900',
    border: 'border-amber-500',
    dot: '#f6bf26',
  },
  sage: {
    id: 'sage',
    name: 'Szałwia',
    bg: 'bg-emerald-500',
    text: 'text-white',
    border: 'border-emerald-600',
    dot: '#33b679',
  },
  basil: {
    id: 'basil',
    name: 'Bazylia',
    bg: 'bg-green-700',
    text: 'text-white',
    border: 'border-green-800',
    dot: '#0b8043',
  },
  peacock: {
    id: 'peacock',
    name: 'Paw',
    bg: 'bg-sky-600',
    text: 'text-white',
    border: 'border-sky-700',
    dot: '#039be5',
  },
  blueberry: {
    id: 'blueberry',
    name: 'Jagoda',
    bg: 'bg-indigo-600',
    text: 'text-white',
    border: 'border-indigo-700',
    dot: '#3f51b5',
  },
  lavender: {
    id: 'lavender',
    name: 'Lawenda',
    bg: 'bg-violet-400',
    text: 'text-white',
    border: 'border-violet-500',
    dot: '#7986cb',
  },
  grape: {
    id: 'grape',
    name: 'Winogrono',
    bg: 'bg-purple-600',
    text: 'text-white',
    border: 'border-purple-700',
    dot: '#8e24aa',
  },
  graphite: {
    id: 'graphite',
    name: 'Grafit',
    bg: 'bg-stone-600',
    text: 'text-white',
    border: 'border-stone-700',
    dot: '#616161',
  },
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ai: {
    enabled: true,
    model: 'gemma-2-2b-local',
    autoExtractEvents: true,
    temperature: 0.2,
    modelLoaded: true,
    downloadProgress: 100,
  },
  security: {
    pinEnabled: false,
    pinCode: '',
    autoLockMinutes: 5,
    isLocked: false,
  },
  soundEnabled: true,
  vibrationEnabled: true,
  startOfWeek: 1, // Poniedziałek
  theme: 'light',
};

export const STANDARD_REMINDER_OPTIONS = [
  { value: 0, label: 'W chwili wydarzenia' },
  { value: 5, label: '5 minut wcześniej' },
  { value: 10, label: '10 minut wcześniej' },
  { value: 15, label: '15 minut wcześniej' },
  { value: 30, label: '30 minut wcześniej' },
  { value: 60, label: '1 godzinę wcześniej' },
  { value: 120, label: '2 godziny wcześniej' },
  { value: 1440, label: '1 dzień wcześniej' },
];

export const MONTH_NAMES_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const DAY_NAMES_SHORT_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
export const DAY_NAMES_FULL_PL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
