import { RUSSIAN_UI } from './russian';
import { GERMAN_UI } from './german';
export type AppLanguage = 'pl' | 'en' | 'ru' | 'de';

export const MONTH_NAMES: Record<AppLanguage, string[]> = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  pl: [
    'Styczeń',
    'Luty',
    'Marzec',
    'Kwiecień',
    'Maj',
    'Czerwiec',
    'Lipiec',
    'Sierpień',
    'Wrzesień',
    'Październik',
    'Listopad',
    'Grudzień',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

export const DAY_NAMES_SHORT: Record<AppLanguage, string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  pl: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

export const DAY_NAMES_FULL: Record<AppLanguage, string[]> = {
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
  pl: [
    'Poniedziałek',
    'Wtorek',
    'Środa',
    'Czwartek',
    'Piątek',
    'Sobota',
    'Niedziela',
  ],
  en: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],
};

const BASE_TRANSLATIONS = {
  pl: {
    appName: 'Kalendarz',
    today: 'Dziś',
    year: 'Rok',
    month: 'Miesiąc',
    week: 'Tydzień',
    day: 'Dzień',
    agenda: 'Harmonogram',
    create: 'Utwórz',
    search: 'Szukaj',
    searchPlaceholder: 'Szukaj wydarzeń, osób, miejsc...',
    sync: 'Synchronizuj',
    settings: 'Ustawienia',
    assistant: 'Asystent',
    allDay: 'Cały dzień',
    noEvents: 'Brak zaplanowanych wydarzeń',
    newEvent: 'Nowe wydarzenie',
    editEvent: 'Edytuj wydarzenie',
    deleteEvent: 'Usuń wydarzenie',
    deleteConfirmTitle: 'Usuń wydarzenie',
    deleteConfirmDesc: 'Czy na pewno chcesz usunąć to wydarzenie z kalendarza?',
    yesDelete: 'Tak, usuń',
    noCancel: 'Nie',
    save: 'Zapisz',
    cancel: 'Anuluj',
    titlePlaceholder: 'Dodaj tytuł wydarzenia',
    locationPlaceholder: 'Lokalizacja (np. Gabinet, Biuro, Park)',
    descPlaceholder: 'Notatki lub opis spotkania...',
    color: 'Kolor',
    repeat: 'Powtarzanie',
    reminders: 'Powiadomienia',
    addReminder: 'Dodaj przypomnienie',
    customRepeat: 'Niestandardowe...',
    // Pin lock
    pinLockedTitle: 'Kalendarz zablokowany',
    pinEnterCode: 'Wprowadź 4-cyfrowy kod PIN',
    pinIncorrect: 'Niepoprawny PIN. Spróbuj ponownie.',
    // Settings
    settingsTitle: 'Ustawienia kalendarza',
    theme: 'Motyw kolorystyczny',
    themeDesc: 'Dostosuj styl całej aplikacji',
    language: 'Język / Language',
    languageDesc: 'Wybierz język interfejsu (Polski / English / Русский / Deutsch)',
    defaultEventSettings: 'Domyślne ustawienia wydarzeń',
    defaultDuration: 'Domyślny czas trwania:',
    defaultReminderLabel: 'Domyślne przypomnienie:',
    defaultColorLabel: 'Domyślny kolor wpisów:',
    soundAndVib: 'Dźwięki i wibracje',
    soundEnabled: 'Dźwięk powiadomień',
    vibrationEnabled: 'Wibracja w telefonie',
    testSound: 'Testuj dźwięk',
    testVibration: 'Testuj wibrację',
    aiAssistantTitle: 'Lokalny Asystent Kalendarza',
    aiAssistantDesc: '100% Offline NLP • 0 telemetrii',
    pinLock: 'Blokada kodem PIN',
    pinLockDesc: 'Zabezpiecz kalendarz 4-cyfrowym kodem',
    holidaysSection: 'Polskie święta i dni wolne',
    holidaysDesc: `Oficjalne dni ustawowo wolne od pracy (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    holidaysInCalendar: 'W kalendarzu znajduje się',
    holidaysUnit: 'polskich świąt',
    addHolidaysBtn: `Dodaj polskie święta (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    updateHolidaysBtn: `Zaktualizuj polskie święta (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    removeHolidaysBtn: 'Usuń polskie święta z kalendarza',
    holidaysRemoved: 'Usunięto polskie święta z kalendarza!',
    holidaysAdded: 'Dodano polskie święta do kalendarza!',
    backupAndData: 'Kopia zapasowa i dane',
    downloadIcs: 'Pobierz plik .ics',
    uploadIcs: 'Wczytaj plik .ics',
    clearAllEvents: 'Wyczyść wszystkie wydarzenia',
    clearConfirm: 'Czy na pewno chcesz usunąć wszystkie wydarzenia?',
    close: 'Zamknij',
  },
  en: {
    appName: 'Calendar',
    today: 'Today',
    year: 'Year',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Schedule',
    create: 'Create',
    search: 'Search',
    searchPlaceholder: 'Search events, people, places...',
    sync: 'Sync',
    settings: 'Settings',
    assistant: 'Assistant',
    allDay: 'All day',
    noEvents: 'No upcoming events',
    newEvent: 'New event',
    editEvent: 'Edit event',
    deleteEvent: 'Delete event',
    deleteConfirmTitle: 'Delete event',
    deleteConfirmDesc:
      'Are you sure you want to delete this event from the calendar?',
    yesDelete: 'Yes, delete',
    noCancel: 'No',
    save: 'Save',
    cancel: 'Cancel',
    titlePlaceholder: 'Add event title',
    locationPlaceholder: 'Location (e.g. Office, Home, Park)',
    descPlaceholder: 'Notes or description...',
    color: 'Color',
    repeat: 'Recurrence',
    reminders: 'Reminders',
    addReminder: 'Add reminder',
    customRepeat: 'Custom...',
    // Pin lock
    pinLockedTitle: 'Calendar Locked',
    pinEnterCode: 'Enter 4-digit PIN code',
    pinIncorrect: 'Incorrect PIN. Please try again.',
    // Settings
    settingsTitle: 'Calendar Settings',
    theme: 'Color Theme',
    themeDesc: 'Customize the look and feel of the app',
    language: 'Language / Język',
    languageDesc: 'Choose interface language (Polski / English / Русский / Deutsch)',
    defaultEventSettings: 'Default Event Options',
    defaultDuration: 'Default event duration:',
    defaultReminderLabel: 'Default reminder:',
    defaultColorLabel: 'Default color:',
    soundAndVib: 'Sounds & Vibration',
    soundEnabled: 'Notification sound',
    vibrationEnabled: 'Phone vibration',
    testSound: 'Test sound',
    testVibration: 'Test vibration',
    aiAssistantTitle: 'Local Calendar Assistant',
    aiAssistantDesc: '100% Offline NLP • Zero telemetry',
    pinLock: 'PIN Code Lock',
    pinLockDesc: 'Secure your calendar with a 4-digit PIN',
    holidaysSection: 'Polish Public Holidays',
    holidaysDesc: `Official statutory non-working days (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    holidaysInCalendar: 'In your calendar:',
    holidaysUnit: 'public holidays',
    addHolidaysBtn: `Add Polish Holidays (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    updateHolidaysBtn: `Update Polish Holidays (${new Date().getFullYear()}–${new Date().getFullYear() + 5})`,
    removeHolidaysBtn: 'Remove Polish Holidays from Calendar',
    holidaysRemoved: 'Polish holidays removed from calendar!',
    holidaysAdded: 'Polish holidays added to calendar!',
    backupAndData: 'Backup & Data',
    downloadIcs: 'Export .ics file',
    uploadIcs: 'Import .ics file',
    clearAllEvents: 'Clear all events',
    clearConfirm: 'Are you sure you want to delete all events?',
    close: 'Close',
  },
};

function makeTranslator(messages: Record<string, string>) {
  const patterns = Object.entries(messages)
    .filter(([key]) => key.includes('{{'))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([key, value]) => {
      const slots: number[] = [];
      const pattern = key.split(/(\{\{\d+\}\})/).map(part => {
        if (/^\{\{\d+\}\}$/.test(part)) { slots.push(Number(part.slice(2, -2))); return '(.*?)'; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { pattern: new RegExp(`^${pattern}$`, 's'), value, slots };
    });
  return (text: string): string => {
    if (Object.hasOwn(messages, text)) return messages[text];
    for (const { pattern, value, slots } of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      return value.replace(/\{\{(\d+)\}\}/g, (_, i) => match[slots.indexOf(Number(i)) + 1] ?? '');
    }
    return text;
  };
}
export const translateRussian = makeTranslator(RUSSIAN_UI);
export const translateGerman = makeTranslator(GERMAN_UI);
function localizedValue<T>(value: T, translate: (text: string) => string): T {
  if (typeof value === 'string') return translate(value) as T;
  if (Array.isArray(value)) return value.map(item => localizedValue(item, translate)) as T;
  return value;
}
/** Translate UI templates while leaving interpolated user data intact. */
export function tr<P, E>(language: string, polish: P, english: E): P | E {
  return language === 'pl' ? polish : language === 'ru' ? localizedValue(english, translateRussian) : language === 'de' ? localizedValue(english, translateGerman) : english;
}
export const TRANSLATIONS = {
  ...BASE_TRANSLATIONS,
  de: Object.fromEntries(Object.entries(BASE_TRANSLATIONS.en).map(([key, value]) => [key, translateGerman(value)])) as Record<keyof typeof BASE_TRANSLATIONS.en, string>,
  ru: Object.fromEntries(Object.entries(BASE_TRANSLATIONS.en).map(([key, value]) => [key, translateRussian(value)])) as Record<keyof typeof BASE_TRANSLATIONS.en, string>,
};

export const getTranslation = (lang: AppLanguage = 'en') =>
  TRANSLATIONS[lang] || TRANSLATIONS.en;

export function reminderLabel(value: number, language: AppLanguage = 'pl') {
  if (value === 0)
    return tr(language, 'W momencie rozpoczęcia', 'At start');
  return tr(language, `${value} min wcześniej`, `${value} min before`);
}
export const colorLabel = (
  id: string,
  language: AppLanguage = 'pl',
  fallback = id,
) => language === 'pl' ? fallback : language === 'de' ? ({ tomato: 'Rot', flamingo: 'Rosa', tangerine: 'Orange', banana: 'Gelb', sage: 'Salbei', basil: 'Grün', peacock: 'Türkis', blueberry: 'Blau', lavender: 'Lavendel', grape: 'Violett', graphite: 'Graphit' }[id] || id) : language === 'ru' ? ({ tomato: 'Красный', flamingo: 'Розовый', tangerine: 'Оранжевый', banana: 'Жёлтый', sage: 'Шалфейный', basil: 'Зелёный', peacock: 'Бирюзовый', blueberry: 'Синий', lavender: 'Лавандовый', grape: 'Фиолетовый', graphite: 'Графитовый' }[id] || id) : id.charAt(0).toUpperCase() + id.slice(1);
