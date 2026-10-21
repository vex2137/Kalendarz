import { buildEventIndex } from './recurrence';
import { localDate, addDays, timeString } from './dates';
import { CalendarEvent, GoogleCalendarColor } from '../types';
import { AppLanguage } from './i18n';
import { availableSlots, DEFAULT_PLANNING, minutes, moveDraft, planGroup, planningPreferences, requestedDuration, searchCalendar, type AssistantPlan } from './assistantPlanning';
import type { PlanningPreferences } from '../types';

export interface ExtractedEventSuggestion {
  title: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  color?: GoogleCalendarColor;
  recurrence?: CalendarEvent["recurrence"];
}

export interface AiConversationContext {
  pendingPrompt?: string;
  movingEvent?: CalendarEvent;
  moveChoices?: CalendarEvent[];
  moveRequest?: string;
  suggestedEvent?: Partial<CalendarEvent>;
}

export interface AiResponseResult {
  context?: AiConversationContext;
  suggestedPlan?: AssistantPlan;
  text: string;
  suggestedEvent?: Partial<CalendarEvent>;
  eventToDelete?: CalendarEvent;
  suggestedPrompts?: string[];
}

// Helper to format Date to YYYY-MM-DD
export const formatDateISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const POLISH_MONTHS: { name: string; index: number }[] = [
  { name: 'stycz', index: 0 },
  { name: 'lut', index: 1 },
  { name: 'mar', index: 2 },
  { name: 'kwiet', index: 3 },
  { name: 'maj', index: 4 },
  { name: 'czerw', index: 5 },
  { name: 'lip', index: 6 },
  { name: 'sierp', index: 7 },
  { name: 'wrzes', index: 8 },
  { name: 'wrześ', index: 8 },
  { name: 'paździer', index: 9 },
  { name: 'pazdzier', index: 9 },
  { name: 'listopad', index: 10 },
  { name: 'grudzi', index: 11 },
];

const ENGLISH_MONTHS: { name: string; index: number }[] = [
  { name: 'jan', index: 0 },
  { name: 'feb', index: 1 },
  { name: 'mar', index: 2 },
  { name: 'apr', index: 3 },
  { name: 'may', index: 4 },
  { name: 'jun', index: 5 },
  { name: 'jul', index: 6 },
  { name: 'aug', index: 7 },
  { name: 'sep', index: 8 },
  { name: 'oct', index: 9 },
  { name: 'nov', index: 10 },
  { name: 'dec', index: 11 },
];

const DAYS_MAP: {
  pattern: RegExp;
  targetDay: number;
  labelPl: string;
  labelEn: string;
}[] = [
  {
    pattern: /(?:w\s+|we\s+)?poniedzia[łl]ek|monday|mon/i,
    targetDay: 1,
    labelPl: 'W poniedziałek',
    labelEn: 'On Monday',
  },
  {
    pattern: /(?:we\s+|w\s+)?wtorek|tuesday|tue/i,
    targetDay: 2,
    labelPl: 'We wtorek',
    labelEn: 'On Tuesday',
  },
  {
    pattern: /(?:w\s+)?środ[ęe]|srod[ęe]|wednesday|wed/i,
    targetDay: 3,
    labelPl: 'W środę',
    labelEn: 'On Wednesday',
  },
  {
    pattern: /(?:w\s+)?czwartek|thursday|thu/i,
    targetDay: 4,
    labelPl: 'W czwartek',
    labelEn: 'On Thursday',
  },
  {
    pattern: /(?:w\s+)?pi[ąa]tek|friday|fri/i,
    targetDay: 5,
    labelPl: 'W piątek',
    labelEn: 'On Friday',
  },
  {
    pattern: /(?:w\s+)?sobot[ęe]|saturday|sat/i,
    targetDay: 6,
    labelPl: 'W sobotę',
    labelEn: 'On Saturday',
  },
  {
    pattern: /(?:w\s+)?niedziel[ęe]|sunday|sun/i,
    targetDay: 0,
    labelPl: 'W niedzielę',
    labelEn: 'On Sunday',
  },
];

function getNextDayOfWeek(date: Date, targetDayOfWeek: number): Date {
  const result = new Date(date);
  const currentDay = result.getDay();
  let diff = targetDayOfWeek - currentDay;
  if (diff <= 0) diff += 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function calculateEndTime(start: string, durationMinutes: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${pad2(endH)}:${pad2(endM)}`;
}

// Smart color deduction based on event context
export const deduceEventColor = (text: string): GoogleCalendarColor => {
  const lower = text.toLowerCase();
  if (
    lower.match(
      /lekarz|dentyst|badani|szpital|apteka|medyc|recept|zdrowie|piln|okulist|kardiolog|fizjo|doctor|dentist|hospital|health|clinic|urgent/,
    )
  ) {
    return 'tomato'; // red
  }
  if (
    lower.match(
      /sport|trening|bieg|siłow|mecz|rower|basen|joga|fitness|spacer|pilka|piłka|gym|tenis|workout|run|training|match|bike|swim|walk/,
    )
  ) {
    return 'sage'; // green
  }
  if (
    lower.match(
      /obiad|kolacja|randka|urodzin|imprez|rodzin|mama|tata|kino|teatr|znajomi|piwo|spotkanie ze znajomymi|dinner|lunch|date|birthday|party|family|friends|cinema/,
    )
  ) {
    return 'flamingo'; // rose
  }
  if (
    lower.match(
      /zakup|sklep|pieniądz|przelew|rachun|opłat|auto|mechanik|warsztat|bank|poczta|kurier|shopping|store|payment|bill|car|mechanic/,
    )
  ) {
    return 'tangerine'; // orange
  }
  if (
    lower.match(
      /odpoczynek|relaks|urlop|wakacje|plaża|wolne|weekend|wyjazd|chill|holiday|vacation|relax|beach|trip/,
    )
  ) {
    return 'banana'; // yellow
  }
  if (
    lower.match(
      /studia|egzamin|szkoła|lekcja|kurs|nauka|książk|szkolenie|warsztaty|projekt|uczelnia|exam|study|school|lesson|course|reading|workshop/,
    )
  ) {
    return 'grape'; // purple
  }
  if (
    lower.match(
      /praca|biuro|klient|call|zoom|meet|zarząd|faktura|prezentacja|rekrutacja|sync|standup|work|office|client|meeting|presentation/,
    )
  ) {
    return 'blueberry'; // indigo
  }
  return 'peacock'; // default blue
};

/**
 * Parses target date from natural language input (Polish & English)
 */
export function parseDateFromNaturalLanguage(
  text: string,
  referenceDate: Date = new Date(),
  lang: AppLanguage = 'en',
): { date: Date; dateStr: string; label: string; matched: boolean } {
  const lower = text.toLowerCase();
  const target = new Date(referenceDate);

  const weeks = lower.match(/(?:za|in)\s+(\d+|dwa|dwie|two|jeden|one)\s+(?:tygodni\w*|weeks?)/i);
  if (weeks) {
    const count = /^(dwa|dwie|two)$/.test(weeks[1]) ? 2 : /^(jeden|one)$/.test(weeks[1]) ? 1 : Number(weeks[1]);
    target.setDate(target.getDate() + count * 7);
    return { date: target, dateStr: formatDateISO(target), label: formatDateISO(target), matched: true };
  }

  // Relative: Pojutrze / In 2 days
  if (
    lower.includes('pojutrze') ||
    lower.includes('day after tomorrow') ||
    lower.includes('in 2 days') ||
    lower.includes('za 2 dni')
  ) {
    target.setDate(target.getDate() + 2);
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: lang === 'pl' ? 'Pojutrze' : 'Day after tomorrow',
      matched: true,
    };
  }

  // Relative: Za 3 dni / in 3 days
  const inDaysMatch = lower.match(/(?:za|in)\s+(\d+|dwa|dwie|trzy|cztery|pięć|piec|two|three|four|five)\s*(?:dni|days?)/i);
  if (inDaysMatch) {
    const dayCounts: Record<string, number> = { dwa: 2, dwie: 2, trzy: 3, cztery: 4, pięć: 5, piec: 5, two: 2, three: 3, four: 4, five: 5 };
    const dCount = dayCounts[inDaysMatch[1]] || Number(inDaysMatch[1]);
    target.setDate(target.getDate() + dCount);
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: lang === 'pl' ? `Za ${dCount} dni` : `In ${dCount} days`,
      matched: true,
    };
  }

  const monthFirst = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
  if (monthFirst) {
    const month = ENGLISH_MONTHS.findIndex(m => monthFirst[1].startsWith(m.name));
    const day = Number(monthFirst[2]), year = Number(monthFirst[3] || referenceDate.getFullYear());
    target.setFullYear(year, month, day);
    return { date: target, dateStr: formatDateISO(target), label: formatDateISO(target), matched: target.getMonth() === month && target.getDate() === day };
  }

  // Relative: Jutro / Tomorrow
  if (lower.includes('jutro') || lower.includes('tomorrow')) {
    target.setDate(target.getDate() + 1);
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: lang === 'pl' ? 'Jutro' : 'Tomorrow',
      matched: true,
    };
  }

  // Relative: Dzisiaj / Today
  if (
    lower.includes('dzisiaj') ||
    lower.includes('dziś') ||
    lower.includes('dzis') ||
    lower.includes('today')
  ) {
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: lang === 'pl' ? 'Dzisiaj' : 'Today',
      matched: true,
    };
  }

  if (/ostatni|ostatnią|last/i.test(lower)) {
    const day = DAYS_MAP.find(entry => entry.pattern.test(lower));
    if (day && /miesiąc|miesiac|month/i.test(lower)) {
      const offset = /następn|nastepn|next/i.test(lower) ? 1 : 0;
      const last = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + offset + 1, 0);
      last.setDate(last.getDate() - (last.getDay() - day.targetDay + 7) % 7);
      return { date: last, dateStr: formatDateISO(last), label: formatDateISO(last), matched: true };
    }
  }

  // Check days of week
  for (const dayEntry of DAYS_MAP) {
    if (new RegExp(`(?<![\\p{L}])(?:${dayEntry.pattern.source})(?![\\p{L}])`, 'iu').test(lower)) {
      const nextDate = getNextDayOfWeek(referenceDate, dayEntry.targetDay);
      if (/next|przyszł|przyszl|następn|nastepn/i.test(lower)) {
        const monday = addDays(localDate(referenceDate), 7 - ((referenceDate.getDay() + 6) % 7));
        const exact = new Date(`${addDays(monday, (dayEntry.targetDay + 6) % 7)}T12:00:00`);
        nextDate.setFullYear(exact.getFullYear(), exact.getMonth(), exact.getDate());
      }
      return {
        date: nextDate,
        dateStr: formatDateISO(nextDate),
        label: lang === 'pl' ? dayEntry.labelPl : dayEntry.labelEn,
        matched: true,
      };
    }
  }

  // Check explicit date (e.g. 15 marca, 22 listopada, 15th March)
  const monthList = [...POLISH_MONTHS, ...ENGLISH_MONTHS];
  for (const monthItem of monthList) {
    const reg = new RegExp(
      `(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s*${monthItem.name}[a-ząćęłńóśźż]*`,
      'i',
    );
    const match = text.match(reg);
    if (match) {
      const dNum = parseInt(match[1], 10);
      target.setDate(1);
      target.setMonth(monthItem.index);
      target.setDate(dNum);
      if (target.getMonth() !== monthItem.index) continue;
      return {
        date: target,
        dateStr: formatDateISO(target),
        label: `${dNum} ${monthItem.name}`,
        matched: true,
      };
    }
  }

  // Format DD.MM (e.g. 15.05 or 15.05.2026)
  const dotDateMatch = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (dotDateMatch) {
    const d = parseInt(dotDateMatch[1], 10);
    const m = parseInt(dotDateMatch[2], 10) - 1;
    const y = dotDateMatch[3]
      ? parseInt(dotDateMatch[3], 10)
      : referenceDate.getFullYear();
    target.setFullYear(y, m, d);
    if (target.getFullYear() !== y || target.getMonth() !== m || target.getDate() !== d) {
      return { date: referenceDate, dateStr: formatDateISO(referenceDate), label: "", matched: false };
    }
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: `${d}.${m + 1}`,
      matched: true,
    };
  }

  // ISO date format YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    target.setFullYear(y, m, d);
    if (target.getFullYear() !== y || target.getMonth() !== m || target.getDate() !== d) {
      return { date: referenceDate, dateStr: formatDateISO(referenceDate), label: "", matched: false };
    }
    return {
      date: target,
      dateStr: formatDateISO(target),
      label: `${y}-${pad2(m + 1)}-${pad2(d)}`,
      matched: true,
    };
  }

  return {
    date: target,
    dateStr: formatDateISO(target),
    label: lang === 'pl' ? 'Dzisiaj' : 'Today',
    matched: false,
  };
}

/**
 * 100% Offline Local Natural Language Event Extractor (Polish & English)
 */
export const extractEventFromPromptOffline = (
  prompt: string,
  referenceDate: Date = new Date(),
  lang: AppLanguage = 'en',
): ExtractedEventSuggestion | null => {
  const text = prompt.trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // Date calculation
  const parsedDate = parseDateFromNaturalLanguage(text, referenceDate, lang);
  const targetDate = parsedDate.date;
  let isAllDay = true;
  let startTime = '10:00';
  let endTime = '11:00';

  // Time range regex (e.g. od 15:30 do 17:00, 14:00 - 15:00, from 10 to 12)
  const timeRangeMatch = text.match(
    /(?<![\d.\-])(?:od\s*|from\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:do|-|to)\s*(\d{1,2})(?:[:.](\d{2}))?(?![\d.\-])/i,
  );
  // Single time regex (e.g. o 18, o 18:30, at 3pm, godzina 15, o 9:00 rano)
  const singleTimeMatch =
    text.match(
      /(?:o|godz(?:inie|\.)?|at)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|rano|wieczorem)?/i,
    ) || text.match(/(\d{1,2}):(\d{2})/);

  if (timeRangeMatch) {
    const startH = parseInt(timeRangeMatch[1], 10);
    const startM = timeRangeMatch[2] ? parseInt(timeRangeMatch[2], 10) : 0;
    const endH = parseInt(timeRangeMatch[3], 10);
    const endM = timeRangeMatch[4] ? parseInt(timeRangeMatch[4], 10) : 0;

    if (startH >= 0 && startH < 24 && endH >= 0 && endH < 24 && startM < 60 && endM < 60) {
      isAllDay = false;
      startTime = `${pad2(startH)}:${pad2(startM)}`;
      endTime = `${pad2(endH)}:${pad2(endM)}`;
    }
  } else if (singleTimeMatch) {
    let hours = parseInt(singleTimeMatch[1], 10);
    const minutes = singleTimeMatch[2] ? parseInt(singleTimeMatch[2], 10) : 0;
    const modifier = (singleTimeMatch[3] || '').toLowerCase();

    if (modifier === 'pm' && hours < 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;
    if (
      (modifier === 'wieczorem' ||
        lower.includes('wieczorem') ||
        lower.includes('evening')) &&
      hours < 12
    ) {
      hours += 12;
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      isAllDay = false;
      startTime = `${pad2(hours)}:${pad2(minutes)}`;

      // Duration extraction (e.g. na 45 minut, na pół godziny, for 2 hours)
      let durationMinutes = 60;
      if (lower.match(/na\s+p[óo][łl]\s+godziny|half an hour/)) {
        durationMinutes = 30;
      } else if (lower.match(/na\s+p[óo][łl]torej\s+godziny|1\.5 hours/)) {
        durationMinutes = 90;
      } else {
        const durationMatch = text.match(
          /(?:na|przez|trwa|for)\s*(\d+)\s*(min(?:ut[y]?)?|h|godz(?:in[yę]?)?|hour[s]?)/i,
        );
        if (durationMatch) {
          const amount = parseInt(durationMatch[1], 10);
          const unit = durationMatch[2].toLowerCase();
          if (unit.startsWith('min')) {
            durationMinutes = amount;
          } else {
            durationMinutes = amount * 60;
          }
        }
      }
      endTime = calculateEndTime(startTime, durationMinutes);
    }
  }

  // Location extraction
  let location: string | undefined;
  const locationMatch = text.match(
    /(?:w|we|w lokalizacji|w biurze|u|na sali|na|at|in)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\s\-]+?)(?=\s+(?:o|godz|od|na|jutro|pojutrze|at|in|tomorrow|$))/i,
  );
  if (locationMatch && locationMatch[1].trim().length > 2) {
    const locCandidate = locationMatch[1].trim();
    if (
      !locCandidate.match(
        /^(poniedziałek|wtorek|środę|srodę|czwartek|piątek|sobotę|niedzielę|ten|ta|to|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
      )
    ) {
      location = locCandidate;
    }
  }

  // Title extraction: remove common prefixes and filler words
  let title = text
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/(?:za|in)\s+(?:\d+|dwa|dwie|two|jeden|one)\s+(?:tygodni\w*|weeks?)/gi, '')
    .replace(/(?:co tydzień|co tydzien|codziennie|co miesiąc|co miesiac|every week|every day|every month|all.day|cały dzień|caly dzien)/gi, '')
    .replace(
      /^(dodaj|zaplanuj|ustaw|wpisz|utwórz|stwórz|muszę pójść do|muszę zrobić|chcę dodać|przypomnij o|przypomnij mi o|mam|add|create|schedule|set|remind me to|plan)\s+/i,
      '',
    )
    .replace(
      /(?:o|godz(?:inie|\.)?|at)\s*\d{1,2}(?:[:.]\d{2})?(?:\s*(?:am|pm|rano|wieczorem))?/gi,
      '',
    )
    .replace(
      /(?:od|from\s*)?\d{1,2}(?:[:.]\d{2})?\s*(?:do|-|to)\s*\d{1,2}(?:[:.]\d{2})?/gi,
      '',
    )
    .replace(
      /(?:na|przez|trwa|for)\s*(?:p[óo][łl]\s+godziny|p[óo][łl]torej\s+godziny|half an hour|\d+\s*(?:min(?:ut[y]?)?|h|godz(?:in[yę]?)?|hour[s]?))/gi,
      '',
    )
    .replace(
      /(dzisiaj|dziś|pojutrze|jutro|w ten weekend|w ten piątek|w najbliższy piątek|w poniedziałek|we wtorek|w środę|w srode|w czwartek|w piątek|w piatek|w sobotę|w sobote|w niedzielę|w niedziele|w weekend|today|day after tomorrow|tomorrow|this weekend|next monday|on friday)/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = lang === 'pl' ? 'Nowe spotkanie' : 'New Meeting';
  }

  const color = deduceEventColor(text);
  const formattedDate = formatDateISO(targetDate);

  return {
    title,
    startDate: formattedDate,
    startTime: isAllDay ? undefined : startTime,
    endDate:
      !isAllDay && startTime && endTime && endTime <= startTime
        ? addDays(formattedDate, 1)
        : formattedDate,
    endTime: isAllDay ? undefined : endTime,
    allDay: isAllDay,
    location,
    description:
      lang === 'pl'
        ? `Dodane przez lokalnego asystenta: "${text}"`
        : `Added by local assistant: "${text}"`,
    color,
    recurrence: /codziennie|every day|daily/i.test(text) ? 'DAILY'
      : /co tydzień|co tydzien|co (?:poniedziałek|wtorek|środę|czwartek|piątek|sobotę|niedzielę)|every (?:week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|weekly/i.test(text) ? 'WEEKLY'
      : /co miesiąc|co miesiac|every month|monthly/i.test(text) ? 'MONTHLY' : 'NONE',
  };
};

/**
 * 100% Offline Conversational Calendar Assistant Engine
 */
export const runLocalAiAssistant = async (
  query: string,
  events: CalendarEvent[],
  lang: AppLanguage = 'en',
  now = new Date(),
  context: AiConversationContext = {},
  preferences: PlanningPreferences = DEFAULT_PLANNING,
): Promise<AiResponseResult> => {
  // Ultra-responsive local NLP processing

  const prefs = planningPreferences(preferences);
  const raw = query.trim();
  const lower = raw.toLowerCase();
  const todayStr = localDate(now);
  const eventsOn = (date: string) =>
    (buildEventIndex(events, date, date).get(date) || []).map((o) => ({
      ...o.event,
      startDate: date,
      endDate: date,
      startTime: o.event.allDay ? undefined : timeString(o.startMinutes),
      endTime: o.event.allDay
        ? undefined
        : o.endMinutes === 1440
          ? '24:00'
          : timeString(o.endMinutes),
    }));

  const group = planGroup(raw, events, prefs, now, lang);
  if (group) return group;

  const move = raw.match(/^(?:przenieś|przenies|przełóż|przeloz|move|reschedule)\s+(.+?)(?:\s+(?:na|to)\s+(.+))?$/i);
  const choice = context.moveChoices && /^\d+$/.test(raw) ? context.moveChoices[Number(raw) - 1] : undefined;
  if (move || (context.movingEvent && parseDateFromNaturalLanguage(raw, now, lang).matched && !/^(?:dodaj|add|schedule|zaplanuj|what|co mam)/i.test(raw)) || choice) {
    const candidates = move ? searchCalendar(events, move[1]) : choice ? [choice] : context.movingEvent ? [context.movingEvent] : [];
    const request = move ? move[2] || '' : choice ? context.moveRequest || '' : raw;
    if (candidates.length !== 1) return {
      text: candidates.length ? (lang === 'pl' ? 'Wybierz wydarzenie, wpisując numer:\n' : 'Select an event by number:\n') + candidates.slice(0, 20).map((e, i) => `${i + 1}. ${e.title} — ${e.startDate} ${e.startTime || ''}`).join('\n') : lang === 'pl' ? 'Nie znalazłem pasującego wydarzenia. Podaj jego tytuł.' : 'No matching event was found. Please provide its title.',
      context: candidates.length ? { moveChoices: candidates.slice(0, 20), moveRequest: request } : {},
      suggestedPrompts: candidates.slice(0, 20).map((_, i) => String(i + 1)),
    };
    const original = candidates[0];
    if (original.recurrence !== 'NONE' || original.rrule || original.exdates?.length) return { text: lang === 'pl' ? 'To wydarzenie należy do serii. Otwórz je w kalendarzu, aby wybrać zakres zmiany serii.' : 'This event belongs to a recurring series. Open it in the calendar to choose the scope of the series change.' };
    const parsed = parseDateFromNaturalLanguage(request, now, lang);
    if (!parsed.matched) return { text: lang === 'pl' ? `Na jaki dzień przenieść „${original.title}”?` : `Which date should I move “${original.title}” to?`, context: { movingEvent: original } };
    const clock = request.match(/(?:o|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let time: string | undefined;
    if (clock) {
      const hour = Number(clock[1]), minute = Number(clock[2] || 0);
      if (hour > (clock[3] ? 12 : 23) || (clock[3] && hour < 1) || minute > 59) return { text: lang === 'pl' ? 'Podaj poprawną godzinę.' : 'Please provide a valid time.', context: { movingEvent: original } };
      time = timeString((clock[3] ? hour % 12 + (clock[3].toLowerCase() === 'pm' ? 12 : 0) : hour) * 60 + minute);
    }
    const plan = moveDraft(original, parsed.dateStr, time);
    const draft = plan.events[0];
    const overlap = buildEventIndex(events.filter(e => e.id !== original.id), draft.startDate!, draft.endDate!);
    const collides = [...overlap.values()].flat().some(o => {
      const from = o.date === draft.startDate ? minutes(draft.startTime || '00:00') : 0;
      const to = o.date === draft.endDate ? minutes(draft.endTime || '24:00') : 1440;
      return original.allDay || o.event.allDay || (o.startMinutes < to && o.endMinutes > from);
    });
    return { text: (lang === 'pl' ? 'Sprawdź zmianę przed zatwierdzeniem.' : 'Review the change before confirming.') + (collides ? (lang === 'pl' ? ' Uwaga: nowy termin koliduje z innym wydarzeniem.' : ' Warning: the new time conflicts with another event.') : ''), suggestedPlan: plan };
  }

  // Only explicit follow-ups use the previous draft; calendar data is never changed here.
  if (context.suggestedEvent && /^(?:jednak|zmień|zmien|przesuń|przesun|actually|instead|move|make it)/i.test(raw)) {
    const draft = { ...context.suggestedEvent };
    const shift = raw.match(/(?:o\s+)?(godzinę|godzine|hour|\d+\s*(?:minut|min|hours?|godzin\w*))\s*(później|pozniej|wcześniej|wczesniej|later|earlier)/i);
    const date = parseDateFromNaturalLanguage(raw, now, lang);
    const time = raw.match(/(?:o|at)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/i);
    if (shift && draft.startTime && draft.endTime && draft.startDate && draft.endDate) {
      const amount = Number(shift[1].match(/\d+/)?.[0] || 1) * (/min/i.test(shift[1]) ? 1 : 60);
      const delta = amount * (/wcze|earlier/i.test(shift[2]) ? -1 : 1);
      for (const edge of ['start', 'end'] as const) {
        const [h, m] = draft[`${edge}Time`]!.split(':').map(Number);
        const total = h * 60 + m + delta;
        draft[`${edge}Date`] = addDays(draft[`${edge}Date`]!, Math.floor(total / 1440));
        draft[`${edge}Time`] = timeString(((total % 1440) + 1440) % 1440);
      }
    } else if (date.matched && draft.startDate && draft.endDate) {
      const days = Math.round((Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000);
      draft.startDate = date.dateStr;
      draft.endDate = addDays(date.dateStr, days);
    }
    if (!shift && time) {
      const hour = Number(time[1]) % (time[3] ? 12 : 24) + (time[3]?.toLowerCase() === 'pm' ? 12 : 0);
      const minute = Number(time[2] || 0);
      if (Number(time[1]) > (time[3] ? 12 : 23) || minute > 59) return { text: lang === 'pl' ? 'Podaj poprawną godzinę.' : 'Please provide a valid time.', context };
      const oldStart = draft.startTime?.split(':').map(Number);
      const oldEnd = draft.endTime?.split(':').map(Number);
      const duration = oldStart && oldEnd ? ((oldEnd[0] * 60 + oldEnd[1] - oldStart[0] * 60 - oldStart[1] + 1440) % 1440 || 60) : 60;
      draft.startTime = timeString(hour * 60 + minute);
      draft.endTime = timeString((hour * 60 + minute + duration) % 1440);
      draft.endDate = addDays(draft.startDate!, Math.floor((hour * 60 + minute + duration) / 1440));
      draft.allDay = false;
    } else if (!shift && !date.matched) {
      return { text: lang === 'pl' ? 'Podaj nową datę, godzinę albo przesunięcie, np. „jednak godzinę później”.' : 'Provide a new date, time, or offset, e.g. “actually one hour later”.', context };
    }
    return { text: lang === 'pl' ? 'Zaktualizowałem propozycję. Zatwierdź ją, aby dodać wydarzenie.' : 'The draft has been updated. Confirm it to add the event.', suggestedEvent: draft, context: { suggestedEvent: draft } };
  }

  if (context.pendingPrompt && !/^(?:dodaj|add|create|zaplanuj|schedule|co mam|what|kiedy|when|usuń|delete|remove)\b/i.test(raw) && (parseDateFromNaturalLanguage(raw, now, lang).matched || /^(?:o |at |cały dzień|caly dzien|all.day)/i.test(raw))) {
    return runLocalAiAssistant(`${context.pendingPrompt} ${raw}`, events, lang, now, {}, prefs);
  }

  // 1. Greetings
  if (
    lower.match(
      /^(cześć|czesc|hej|siema|witaj|dzień dobry|dzien dobry|witam|hello|hi|hey|good morning|good afternoon)[\s!.]*$/i,
    )
  ) {
    const todayEvents = eventsOn(todayStr);
    const count = todayEvents.length;

    if (lang === 'pl') {
      const form =
        count === 1
          ? 'wydarzenie'
          : count >= 2 && count <= 4
            ? 'wydarzenia'
            : 'wydarzeń';
      return {
        text: `Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza.\n\nNa dzisiaj masz zaplanowane **${count}** ${form}.\n\nW czym mogę Ci pomóc? Możesz zapytać:\n• *„Co mam dzisiaj w planie?”*\n• *„Kiedy mam wolne dzisiaj?”*\n• *„Czy mam wolny czwartek?”*\n• *„Dodaj trening jutro o 18:00”*`,
        suggestedPrompts: [
          'Co mam dzisiaj w planie?',
          'Kiedy mam wolne dzisiaj?',
          'Czy mam wolny czwartek?',
          'Sprawdź kolizje terminów',
        ],
      };
    } else {
      return {
        text: `Hello! 👋 I am your local calendar assistant (100% Offline).\n\nYou have **${count}** event${count === 1 ? '' : 's'} scheduled for today.\n\nHow can I help you? Try asking:\n• *“What’s on my schedule today?”*\n• *“When do I have free time today?”*\n• *“Do I have free time on Friday?”*\n• *“Add workout tomorrow at 6pm”*`,
        suggestedPrompts: [
          'What is on my schedule today?',
          'When do I have free time today?',
          'Check for conflicting events',
          'Summary of this week',
        ],
      };
    }
  }

  // 2. Thanks & acknowledgements
  if (
    lower.match(
      /^(dzięki|dzieki|dziękuję|dziekuje|super|ekstra|dzięki wielkie|dziękuje bardzo|świetnie|ok|thanks|thank you|great|awesome)[\s!.]*$/i,
    )
  ) {
    return {
      text:
        lang === 'pl'
          ? `Nie ma za co, cieszę się, że mogłem pomóc! 😊\n\nDaj znać, jeśli chcesz sprawdzić grafik lub zaplanować kolejne spotkanie.`
          : `You're welcome! Glad I could help! 😊\n\nLet me know if you want to check your schedule or plan another event.`,
      suggestedPrompts:
        lang === 'pl'
          ? ['Kiedy mam wolne dzisiaj?', 'Co mam zaplanowane na jutro?']
          : ['When do I have free time today?', 'What is on for tomorrow?'],
    };
  }

  // 3. Conflict / overlap detection
  if (
    lower.includes('kolizj') ||
    lower.includes('konflikt') ||
    lower.includes('nakłada') ||
    lower.includes('nakladaja') ||
    lower.includes('conflict') ||
    lower.includes('overlap')
  ) {
    const conflicts: string[] = [];
    let conflictEvent: CalendarEvent | undefined;

    const byDate = buildEventIndex(events, todayStr, addDays(todayStr, 59));
    outer: for (const [date, bucket] of byDate) {
      const timed = bucket.filter((o) => !o.event.allDay);
      for (let i = 0; i < timed.length; i++) {
        for (
          let j = i + 1;
          j < timed.length && timed[j].startMinutes < timed[i].endMinutes;
          j++
        ) {
          const a = timed[i],
            b = timed[j];
          if (!conflictEvent) conflictEvent = [a.event, b.event].find(e => e.recurrence === 'NONE' && !e.rrule && !e.allDay);
          conflicts.push(
            `• **${date}**: „${a.event.title}” (${timeString(a.startMinutes)} – ${timeString(a.endMinutes)}) ⇄ „${b.event.title}” (${timeString(b.startMinutes)} – ${timeString(b.endMinutes)})`,
          );
          if (conflicts.length === 100) break outer;
        }
      }
    }

    if (conflicts.length === 0) {
      return {
        text:
          lang === 'pl'
            ? `✅ **Brak kolizji terminów!**\n\nPrzeanalizowałem nadchodzące 60 dni — żadne wydarzenia godzinowe nie nakładają się na siebie. Wszystko jest idealnie zorganizowane.`
            : `✅ **No schedule conflicts found!**\n\nI analyzed the next 60 days — none of your timed events overlap. Everything is well-organized.`,
        suggestedPrompts:
          lang === 'pl'
            ? ['Kiedy mam wolne dzisiaj?', 'Podsumuj mój tydzień']
            : ['Free time today?', 'Weekly summary'],
      };
    }

    let suggestedPlan: AssistantPlan | undefined;
    if (conflictEvent) {
      const duration = Math.round((Date.parse(conflictEvent.endDate) - Date.parse(conflictEvent.startDate)) / 86400000) * 1440 + minutes(conflictEvent.endTime!) - minutes(conflictEvent.startTime!);
      const slot = availableSlots(events.filter(e => e.id !== conflictEvent!.id), todayStr, addDays(todayStr, 59), duration, prefs, now)[0];
      if (slot) suggestedPlan = moveDraft(conflictEvent, slot.date, timeString(slot.start));
    }
    return {
      suggestedPlan,
      text:
        lang === 'pl'
          ? `⚠️ **Kolizje w nadchodzących 60 dniach (maks. 100 wyników; ${conflicts.length})**:\n\n${conflicts.join('\n')}`
          : `⚠️ **Conflicts in the next 60 days (up to 100 shown; ${conflicts.length})**:\n\n${conflicts.join('\n')}`,
      suggestedPrompts:
        lang === 'pl'
          ? ['Kiedy mam wolne dzisiaj?', 'Co mam na jutro?']
          : ['When am I free today?', 'What is on tomorrow?'],
    };
  }

  // 4. Free time analysis ("Kiedy mam wolne w piątek?", "Free time today?")
  if (
    lower.includes('wolne') ||
    lower.includes('okienko') ||
    lower.includes('kiedy mam czas') ||
    lower.includes('wolny czas') ||
    lower.includes('czy mam woln') ||
    lower.includes('free time') ||
    lower.includes('available') || lower.includes('am i free') || lower.includes('when am i free')
  ) {
    const parsed = parseDateFromNaturalLanguage(raw, now, lang);
    const targetDateStr = parsed.dateStr;
    const label = parsed.label;

    const hours = raw.match(/(?:od|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:do|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const clockMinutes = (h: string, m: string, ampm: string) => (ampm ? Number(h) % 12 + (ampm.toLowerCase() === 'pm' ? 12 : 0) : Number(h)) * 60 + Number(m || 0);
    const start = hours ? clockMinutes(hours[1], hours[2], hours[3]) : minutes(prefs.dayStart);
    const end = hours ? clockMinutes(hours[4], hours[5], hours[6]) : minutes(prefs.dayEnd);
    if (start >= end || end >= 1440 || (hours && (Number(hours[1]) > (hours[3] ? 12 : 23) || Number(hours[4]) > (hours[6] ? 12 : 23) || Number(hours[2] || 0) > 59 || Number(hours[5] || 0) > 59))) return { text: lang === 'pl' ? 'Podaj poprawny zakres godzin.' : 'Please provide a valid time range.' };
    const minimum = requestedDuration(raw) ?? 15;
    const slots = availableSlots(events, targetDateStr, targetDateStr, minimum, { ...prefs, dayStart: timeString(start), dayEnd: timeString(end) }, now);
    return { text: (lang === 'pl' ? `📅 Wolne okienka ${targetDateStr} (minimum ${minimum} min, przerwa ${prefs.bufferMinutes} min):\n` : `📅 Free slots ${targetDateStr} (minimum ${minimum} min, buffer ${prefs.bufferMinutes} min):\n`) + (slots.map(s => `• **${timeString(s.start)} – ${timeString(s.end)}**`).join('\n') || (lang === 'pl' ? 'Brak okienek o wymaganej długości w wybranych dniach i godzinach.' : 'No slots of the requested length within your preferred days and hours.')) };
  }

  // 5. Search specific event by term
  const searchMatch = lower.match(
    /(?:kiedy mam|o której mam|gdzie mam|znajdź|szukaj|when is|where is|find|search)\s+([a-ząćęłńóśźż0-9\s\-]+)/i,
  );
  if (
    searchMatch &&
    !lower.includes('wolne') &&
    !lower.includes('czas') &&
    !lower.includes('plan') &&
    !lower.includes('free')
  ) {
    const term = searchMatch[1].trim().replace(/\?$/, '');
    if (term.length >= 2) {
      const found = searchCalendar(events, term);

      if (found.length === 0) {
        return {
          text:
            lang === 'pl'
              ? `🔍 Nie znalazłem w kalendarzu żadnego wpisu pasującego do: **„${term}”**.\n\nCzy chcesz dodać to spotkanie? Napisz np. *„Dodaj ${term} w piątek o 14:00”*.`
              : `🔍 Could not find any event matching: **“${term}”**.\n\nWould you like to schedule it? Try typing *“Add ${term} on Friday at 2pm”*.`,
          suggestedPrompts: [
            lang === 'pl'
              ? `Dodaj ${term} jutro o 15:00`
              : `Add ${term} tomorrow at 3pm`,
          ],
        };
      }

      const list = found
        .slice(0, 100)
        .map((e) => {
          const timeStr = e.allDay
            ? lang === 'pl'
              ? 'całodniowe'
              : 'all-day'
            : `${e.startTime || ''} – ${e.endTime || ''}`;
          const locStr = e.location ? ` [📍 ${e.location}]` : '';
          return `• **${e.startDate}** (${timeStr}): **${e.title}**${locStr}`;
        })
        .join('\n');

      return {
        text: `🔍 **${lang === 'pl' ? `Znaleziono wydarzenia pasujące do „${term}”` : `Found events matching “${term}”`} (${found.length})**:\n\n${list}`,
        suggestedPrompts: [
          lang === 'pl' ? 'Kiedy mam wolne dzisiaj?' : 'Free time today?',
          lang === 'pl' ? 'Co mam w tym tygodniu?' : 'This week plan',
        ],
      };
    }
  }

  // Explicit ranges, using the shared recurrence index.
  if (/podsumuj|podsumowanie|tydzień|tydzien|summary|week|miesiąc|miesiac|month/i.test(raw) && !/^(dodaj|zaplanuj|add|create|schedule)\s/i.test(raw) && !/(?:o|at)\s+\d/i.test(raw)) {
    let start = todayStr;
    let end = addDays(start, 6);
    if (/weekend/i.test(raw)) {
      const day = now.getDay();
      start = addDays(start, day === 0 ? -1 : (6 - day + 7) % 7);
      end = addDays(start, 1);
    } else if (/miesiąc|miesiac|month/i.test(raw)) {
      const offset = /następn|nastepn|next/i.test(raw) ? 1 : 0;
      start = localDate(new Date(now.getFullYear(), now.getMonth() + offset, 1));
      end = localDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
    } else if (/tym tygodniu|this week|przyszł|przyszl|next week/i.test(raw)) {
      start = addDays(todayStr, -((now.getDay() + 6) % 7) + (/przyszł|przyszl|next week/i.test(raw) ? 7 : 0));
      end = addDays(start, 6);
    }
    const occurrences = [...buildEventIndex(events, start, end).values()].flat();
    const list = occurrences.slice(0, 20).map(o => `• **${o.date}**: ${o.event.title}`).join('\n');
    return { text: lang === 'pl'
      ? `📊 **Podsumowanie ${start} – ${end}**\n\nLiczba wystąpień w dniach zakresu: **${occurrences.length}**.\n${list || 'Brak wydarzeń.'}`
      : `📊 **Summary ${start} – ${end}**\n\nEvent occurrences across these days: **${occurrences.length}**.\n${list || 'No events.'}` };
  }

  // 7. Schedule for specific day ("Co mam dzisiaj?", "What is on tomorrow?")
  if (
    lower.includes('co mam') ||
    lower.includes('grafik') ||
    lower.includes('mój plan') ||
    lower.includes('moj plan') ||
    lower.includes('harmonogram') ||
    /what(?: is|'s) on|what do i have|show my/i.test(lower) ||
    /(?:what.*schedule|show.*schedule)/i.test(lower) ||
    lower.includes('my plan')
  ) {
    const parsed = parseDateFromNaturalLanguage(raw, now, lang);
    const targetDateStr = parsed.dateStr;
    const label = parsed.label;

    const dayEvents = eventsOn(targetDateStr).sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    if (dayEvents.length === 0) {
      return {
        text:
          lang === 'pl'
            ? `📅 **${label} (${targetDateStr})**: brak zaplanowanych wydarzeń.\n\nTwój dzień jest wolny.`
            : `📅 **${label} (${targetDateStr})**: no scheduled events.\n\nYour day is clear.`,
        suggestedPrompts: [
          lang === 'pl'
            ? `Dodaj spotkanie ${label.toLowerCase()} o 14:00`
            : `Add meeting ${label.toLowerCase()} at 2pm`,
          lang === 'pl' ? 'Kiedy mam wolne dzisiaj?' : 'Free time today?',
        ],
      };
    }

    const items = dayEvents
      .slice(0, 100)
      .map((e) => {
        const timeInfo = e.allDay
          ? `*(${lang === 'pl' ? 'Cały dzień' : 'All day'})*`
          : `**${e.startTime} - ${e.endTime}**`;
        const locInfo = e.location ? ` [📍 ${e.location}]` : '';
        return `• ${timeInfo} – **${e.title}**${locInfo}`;
      })
      .join('\n');

    return {
      text: `📅 **${lang === 'pl' ? `Twój plan na dzień: ${label}` : `Your schedule for: ${label}`} (${targetDateStr})**:\n\n${items}`,
      suggestedPrompts: [
        lang === 'pl'
          ? `Kiedy mam wolne ${label.toLowerCase()}?`
          : `Free time ${label.toLowerCase()}?`,
        lang === 'pl' ? 'Sprawdź kolizje terminów' : 'Check for conflicts',
      ],
    };
  }

  // 8. Event Creation via NLP
  const creation = /^(?:dodaj|zaplanuj|ustaw|wpisz|utwórz|stwórz|przypomnij|add|create|schedule|set|remind|plan)\s/i.test(raw);
  const parsed = parseDateFromNaturalLanguage(raw, now, lang);
  const unsupported = /^(?:usuń|usun|skasuj|delete|remove|przenieś|przenies|move|edytuj|edit)\s/i.test(raw);
  const extracted = !unsupported && (creation || (parsed.matched && /(?:o|at)\s*\d|\d{1,2}:\d{2}/i.test(raw) && !raw.includes('?'))) ? extractEventFromPromptOffline(query, now, lang) : null;
  if (extracted) {
    if (!parsed.matched) return { text: lang === 'pl' ? 'Na jaki dzień zaplanować wydarzenie?' : 'Which date should I schedule the event for?', context: { pendingPrompt: raw } };
    if (extracted.allDay && !/cały dzień|caly dzien|całodniow|all.day/i.test(raw)) return { text: lang === 'pl' ? 'O której godzinie? Możesz też napisać „cały dzień”.' : 'At what time? You can also say “all day”.', context: { pendingPrompt: raw } };
    return {
      text:
        lang === 'pl'
          ? `Zrozumiałem! Przygotowałem propozycję wydarzenia **„${extracted.title}”**:\n\n• Data: **${extracted.startDate}**\n• Godzina: **${extracted.startTime ? `${extracted.startTime} – ${extracted.endTime}` : 'Cały dzień'}**${extracted.location ? `\n• Lokalizacja: **${extracted.location}**` : ''}\n• Kolor: **${extracted.color}**\n\nKliknij przycisk poniżej, aby zatwierdzić dodanie do kalendarza:`
          : `Got it! Here is the proposed event **“${extracted.title}”**:\n\n• Date: **${extracted.startDate}**\n• Time: **${extracted.startTime ? `${extracted.startTime} – ${extracted.endTime}` : 'All day'}**${extracted.location ? `\n• Location: **${extracted.location}**` : ''}\n• Color: **${extracted.color}**\n\nClick the button below to confirm:`,
      suggestedEvent: extracted,
      context: { suggestedEvent: extracted },
      suggestedPrompts:
        lang === 'pl'
          ? ['Kiedy mam wolne dzisiaj?', 'Co mam w ten dzień?']
          : ['Free time today?', 'What is on this day?'],
    };
  }

  // 9. Default Fallback
  return {
    text:
      lang === 'pl'
        ? `Nie rozpoznałem polecenia: *„${raw}”*.\n\nJestem asystentem kalendarza działającym w 100% lokalnie. Oto co potrafię:\n\n1. **Planowanie:** *„Jutro o 16:00 dentysta na 45 minut”* lub *„Obiad w niedzielę o 14:00”*.\n2. **Wolny czas:** *„Kiedy mam wolne dzisiaj?”* lub *„Czy mam wolny czwartek?”*.\n3. **Przegląd:** *„Co mam w piątek?”* lub *„Plan na weekend”*.\n4. **Szukanie:** *„Kiedy mam spotkanie z klientem?”*.\n5. **Kolizje:** *„Czy mam jakieś kolizje w terminach?”*.`
        : `I could not recognize the command: *“${raw}”*.\n\nI am your 100% offline local calendar assistant. Here is what I can do:\n\n1. **Schedule:** *“Dentist tomorrow at 4pm for 45 mins”* or *“Dinner on Sunday at 2pm”*.\n2. **Free time:** *“When do I have free time today?”* or *“Am I free on Friday?”*.\n3. **Agenda:** *“What is on Friday?”* or *“Summary of this week”*.\n4. **Search:** *“Find doctor appointment”*.\n5. **Conflicts:** *“Check for schedule conflicts”*.`,
    suggestedPrompts:
      lang === 'pl'
        ? [
            'Kiedy mam wolne dzisiaj?',
            'Co mam zaplanowane na jutro?',
            'Czy mam wolny czwartek?',
          ]
        : [
            'When do I have free time today?',
            'What is on for tomorrow?',
            'Check for conflicts',
          ],
  };
};
