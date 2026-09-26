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
    model: 'lightweight-nlp',
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
  theme: 'dark',
  defaultEventDuration: 60, // 60 min
  defaultReminder: 15, // 15 min wcześniej
  defaultView: 'month',
  defaultColor: 'peacock',
  timeFormat24h: true,
  compactView: false,
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

import { AppTheme } from '../types';

export interface ThemeDefinition {
  id: AppTheme;
  name: string;
  badge: string;
  bgClass: string;
  surfaceClass: string;
  borderClass: string;
  textClass: string;
  mutedTextClass: string;
  accentClass: string;
  dotColor: string;
  chipClass: string;
}

export const AVAILABLE_THEMES: ThemeDefinition[] = [
  {
    id: 'light',
    name: 'Jasny Google',
    badge: 'Klasyczny',
    bgClass: 'bg-stone-50',
    surfaceClass: 'bg-white',
    borderClass: 'border-stone-200',
    textClass: 'text-stone-900',
    mutedTextClass: 'text-stone-500',
    accentClass: 'bg-blue-600',
    dotColor: '#2563eb',
    chipClass: 'border-blue-500 text-blue-600 bg-blue-50',
  },
  {
    id: 'dark',
    name: 'Ciemny OLED',
    badge: 'Nocny',
    bgClass: 'bg-neutral-950',
    surfaceClass: 'bg-neutral-900',
    borderClass: 'border-neutral-800',
    textClass: 'text-neutral-100',
    mutedTextClass: 'text-neutral-400',
    accentClass: 'bg-blue-500',
    dotColor: '#3b82f6',
    chipClass: 'border-neutral-700 text-blue-400 bg-neutral-800',
  },
  {
    id: 'nord',
    name: 'Nordic Frost',
    badge: 'Arktyczny',
    bgClass: 'bg-slate-950',
    surfaceClass: 'bg-slate-900',
    borderClass: 'border-slate-800',
    textClass: 'text-slate-100',
    mutedTextClass: 'text-slate-400',
    accentClass: 'bg-sky-500',
    dotColor: '#38bdf8',
    chipClass: 'border-sky-800 text-sky-400 bg-slate-800',
  },
  {
    id: 'emerald',
    name: 'Szmaragdowy Las',
    badge: 'Eko / Spokój',
    bgClass: 'bg-[#051c14]',
    surfaceClass: 'bg-[#09291e]',
    borderClass: 'border-emerald-900/60',
    textClass: 'text-emerald-50',
    mutedTextClass: 'text-emerald-400/80',
    accentClass: 'bg-emerald-600',
    dotColor: '#10b981',
    chipClass: 'border-emerald-800 text-emerald-300 bg-[#06241a]',
  },
  {
    id: 'sunset',
    name: 'Ciepły Zachód Słońca',
    badge: 'Bursztyn',
    bgClass: 'bg-[#21110c]',
    surfaceClass: 'bg-[#2f1912]',
    borderClass: 'border-amber-900/60',
    textClass: 'text-amber-50',
    mutedTextClass: 'text-amber-400/80',
    accentClass: 'bg-amber-600',
    dotColor: '#f59e0b',
    chipClass: 'border-amber-800 text-amber-300 bg-[#24130d]',
  },
  {
    id: 'lavender',
    name: 'Cyber Lawenda',
    badge: 'Fiolet / Pastel',
    bgClass: 'bg-[#150f24]',
    surfaceClass: 'bg-[#201838]',
    borderClass: 'border-purple-900/60',
    textClass: 'text-purple-50',
    mutedTextClass: 'text-purple-300/80',
    accentClass: 'bg-violet-600',
    dotColor: '#8b5cf6',
    chipClass: 'border-purple-800 text-purple-300 bg-[#19132c]',
  },
  {
    id: 'moka',
    name: 'Ciepła Mokka',
    badge: 'Kawiarnia',
    bgClass: 'bg-[#f7f3ee]',
    surfaceClass: 'bg-[#ffffff]',
    borderClass: 'border-[#e4dacd]',
    textClass: 'text-[#36271c]',
    mutedTextClass: 'text-[#7d6856]',
    accentClass: 'bg-[#936449]',
    dotColor: '#936449',
    chipClass: 'border-[#cbb9a3] text-[#714d37] bg-[#ede4d8]',
  },
];
