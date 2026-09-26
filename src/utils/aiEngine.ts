import { CalendarEvent, GoogleCalendarColor } from '../types';
import { AppLanguage } from './i18n';

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
}

export interface AiResponseResult {
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

const DAYS_MAP: { pattern: RegExp; targetDay: number; labelPl: string; labelEn: string }[] = [
  { pattern: /(?:w\s+|we\s+)?poniedzia[łl]ek|monday|mon/i, targetDay: 1, labelPl: 'W poniedziałek', labelEn: 'On Monday' },
  { pattern: /(?:we\s+|w\s+)?wtorek|tuesday|tue/i, targetDay: 2, labelPl: 'We wtorek', labelEn: 'On Tuesday' },
  { pattern: /(?:w\s+)?środ[ęe]|srod[ęe]|wednesday|wed/i, targetDay: 3, labelPl: 'W środę', labelEn: 'On Wednesday' },
  { pattern: /(?:w\s+)?czwartek|thursday|thu/i, targetDay: 4, labelPl: 'W czwartek', labelEn: 'On Thursday' },
  { pattern: /(?:w\s+)?pi[ąa]tek|friday|fri/i, targetDay: 5, labelPl: 'W piątek', labelEn: 'On Friday' },
  { pattern: /(?:w\s+)?sobot[ęe]|saturday|sat/i, targetDay: 6, labelPl: 'W sobotę', labelEn: 'On Saturday' },
  { pattern: /(?:w\s+)?niedziel[ęe]|sunday|sun/i, targetDay: 0, labelPl: 'W niedzielę', labelEn: 'On Sunday' },
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
  if (lower.match(/lekarz|dentyst|badani|szpital|apteka|medyc|recept|zdrowie|piln|okulist|kardiolog|fizjo|doctor|dentist|hospital|health|clinic|urgent/)) {
    return 'tomato'; // red
  }
  if (lower.match(/sport|trening|bieg|siłow|mecz|rower|basen|joga|fitness|spacer|pilka|piłka|gym|tenis|workout|run|training|match|bike|swim|walk/)) {
    return 'sage'; // green
  }
  if (lower.match(/obiad|kolacja|randka|urodzin|imprez|rodzin|mama|tata|kino|teatr|znajomi|piwo|spotkanie ze znajomymi|dinner|lunch|date|birthday|party|family|friends|cinema/)) {
    return 'flamingo'; // rose
  }
  if (lower.match(/zakup|sklep|pieniądz|przelew|rachun|opłat|auto|mechanik|warsztat|bank|poczta|kurier|shopping|store|payment|bill|car|mechanic/)) {
    return 'tangerine'; // orange
  }
  if (lower.match(/odpoczynek|relaks|urlop|wakacje|plaża|wolne|weekend|wyjazd|chill|holiday|vacation|relax|beach|trip/)) {
    return 'banana'; // yellow
  }
  if (lower.match(/studia|egzamin|szkoła|lekcja|kurs|nauka|książk|szkolenie|warsztaty|projekt|uczelnia|exam|study|school|lesson|course|reading|workshop/)) {
    return 'grape'; // purple
  }
  if (lower.match(/praca|biuro|klient|call|zoom|meet|zarząd|faktura|prezentacja|rekrutacja|sync|standup|work|office|client|meeting|presentation/)) {
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
  lang: AppLanguage = 'pl'
): { date: Date; dateStr: string; label: string; matched: boolean } {
  const lower = text.toLowerCase();
  const target = new Date(referenceDate);

  // Relative: Pojutrze / In 2 days
  if (lower.includes('pojutrze') || lower.includes('day after tomorrow') || lower.includes('in 2 days') || lower.includes('za 2 dni')) {
    target.setDate(target.getDate() + 2);
    return { date: target, dateStr: formatDateISO(target), label: lang === 'pl' ? 'Pojutrze' : 'Day after tomorrow', matched: true };
  }

  // Relative: Za 3 dni / in 3 days
  const inDaysMatch = lower.match(/(?:za|in)\s+(\d+)\s*(?:dni|day[s]?)/i);
  if (inDaysMatch) {
    const dCount = parseInt(inDaysMatch[1], 10);
    target.setDate(target.getDate() + dCount);
    return { date: target, dateStr: formatDateISO(target), label: lang === 'pl' ? `Za ${dCount} dni` : `In ${dCount} days`, matched: true };
  }

  // Relative: Jutro / Tomorrow
  if (lower.includes('jutro') || lower.includes('tomorrow')) {
    target.setDate(target.getDate() + 1);
    return { date: target, dateStr: formatDateISO(target), label: lang === 'pl' ? 'Jutro' : 'Tomorrow', matched: true };
  }

  // Relative: Dzisiaj / Today
  if (lower.includes('dzisiaj') || lower.includes('dziś') || lower.includes('dzis') || lower.includes('today')) {
    return { date: target, dateStr: formatDateISO(target), label: lang === 'pl' ? 'Dzisiaj' : 'Today', matched: true };
  }

  // Check days of week
  for (const dayEntry of DAYS_MAP) {
    if (dayEntry.pattern.test(lower)) {
      const nextDate = getNextDayOfWeek(referenceDate, dayEntry.targetDay);
      return { 
        date: nextDate, 
        dateStr: formatDateISO(nextDate), 
        label: lang === 'pl' ? dayEntry.labelPl : dayEntry.labelEn, 
        matched: true 
      };
    }
  }

  // Check explicit date (e.g. 15 marca, 22 listopada, 15th March)
  const monthList = [...POLISH_MONTHS, ...ENGLISH_MONTHS];
  for (const monthItem of monthList) {
    const reg = new RegExp(`(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s*${monthItem.name}[a-ząćęłńóśźż]*`, 'i');
    const match = text.match(reg);
    if (match) {
      const dNum = parseInt(match[1], 10);
      target.setMonth(monthItem.index);
      target.setDate(dNum);
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
    const y = dotDateMatch[3] ? parseInt(dotDateMatch[3], 10) : referenceDate.getFullYear();
    target.setFullYear(y, m, d);
    return { date: target, dateStr: formatDateISO(target), label: `${d}.${m + 1}`, matched: true };
  }

  // ISO date format YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    target.setFullYear(y, m, d);
    return { date: target, dateStr: formatDateISO(target), label: `${y}-${pad2(m + 1)}-${pad2(d)}`, matched: true };
  }

  return { date: target, dateStr: formatDateISO(target), label: lang === 'pl' ? 'Dzisiaj' : 'Today', matched: false };
}

/**
 * 100% Offline Local Natural Language Event Extractor (Polish & English)
 */
export const extractEventFromPromptOffline = (
  prompt: string,
  referenceDate: Date = new Date(),
  lang: AppLanguage = 'pl'
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
  const timeRangeMatch = text.match(/(?:od|from\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:do|-|to)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
  // Single time regex (e.g. o 18, o 18:30, at 3pm, godzina 15, o 9:00 rano)
  const singleTimeMatch = text.match(/(?:o|godz(?:inie|\.)?|at)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|rano|wieczorem)?/i) || 
                          text.match(/(\d{1,2}):(\d{2})/);

  if (timeRangeMatch) {
    const startH = parseInt(timeRangeMatch[1], 10);
    const startM = timeRangeMatch[2] ? parseInt(timeRangeMatch[2], 10) : 0;
    const endH = parseInt(timeRangeMatch[3], 10);
    const endM = timeRangeMatch[4] ? parseInt(timeRangeMatch[4], 10) : 0;

    if (startH >= 0 && startH < 24 && endH >= 0 && endH < 24) {
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
    if ((modifier === 'wieczorem' || lower.includes('wieczorem') || lower.includes('evening')) && hours < 12) {
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
        const durationMatch = text.match(/(?:na|przez|trwa|for)\s*(\d+)\s*(min(?:ut[y]?)?|h|godz(?:in[yę]?)?|hour[s]?)/i);
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
  const locationMatch = text.match(/(?:w|we|w lokalizacji|w biurze|u|na sali|na|at|in)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\s\-]+?)(?=\s+(?:o|godz|od|na|jutro|pojutrze|at|in|tomorrow|$))/i);
  if (locationMatch && locationMatch[1].trim().length > 2) {
    const locCandidate = locationMatch[1].trim();
    if (!locCandidate.match(/^(poniedziałek|wtorek|środę|srodę|czwartek|piątek|sobotę|niedzielę|ten|ta|to|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i)) {
      location = locCandidate;
    }
  }

  // Title extraction: remove common prefixes and filler words
  let title = text
    .replace(/^(dodaj|zaplanuj|ustaw|wpisz|utwórz|stwórz|muszę pójść do|muszę zrobić|chcę dodać|przypomnij o|przypomnij mi o|mam|add|create|schedule|set|remind me to|plan)\s+/i, '')
    .replace(/(?:o|godz(?:inie|\.)?|at)\s*\d{1,2}(?:[:.]\d{2})?(?:\s*(?:am|pm|rano|wieczorem))?/gi, '')
    .replace(/(?:od|from\s*)?\d{1,2}(?:[:.]\d{2})?\s*(?:do|-|to)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:na|przez|trwa|for)\s*(?:p[óo][łl]\s+godziny|p[óo][łl]torej\s+godziny|half an hour|\d+\s*(?:min(?:ut[y]?)?|h|godz(?:in[yę]?)?|hour[s]?))/gi, '')
    .replace(/(dzisiaj|dziś|jutro|pojutrze|w ten weekend|w ten piątek|w najbliższy piątek|w poniedziałek|we wtorek|w środę|w srode|w czwartek|w piątek|w piatek|w sobotę|w sobote|w niedzielę|w niedziele|w weekend|today|tomorrow|day after tomorrow|this weekend|next monday|on friday)/gi, '')
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
    endDate: formattedDate,
    endTime: isAllDay ? undefined : endTime,
    allDay: isAllDay,
    location,
    description: lang === 'pl' ? `Dodane przez lokalnego asystenta: "${text}"` : `Added by local assistant: "${text}"`,
    color,
  };
};

/**
 * 100% Offline Conversational Calendar Assistant Engine
 */
export const runLocalAiAssistant = async (
  query: string,
  events: CalendarEvent[],
  lang: AppLanguage = 'pl'
): Promise<AiResponseResult> => {
  // Ultra-responsive local NLP processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  const raw = query.trim();
  const lower = raw.toLowerCase();
  const now = new Date();
  const todayStr = formatDateISO(now);

  // 1. Greetings
  if (lower.match(/^(cześć|czesc|hej|siema|witaj|dzień dobry|dzien dobry|witam|hello|hi|hey|good morning|good afternoon)[\s!.]*$/i)) {
    const todayEvents = events.filter((e) => e.startDate === todayStr);
    const count = todayEvents.length;

    if (lang === 'pl') {
      const form = count === 1 ? 'wydarzenie' : count >= 2 && count <= 4 ? 'wydarzenia' : 'wydarzeń';
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
  if (lower.match(/^(dzięki|dzieki|dziękuję|dziekuje|super|ekstra|dzięki wielkie|dziękuje bardzo|świetnie|ok|thanks|thank you|great|awesome)[\s!.]*$/i)) {
    return {
      text: lang === 'pl'
        ? `Nie ma za co, cieszę się, że mogłem pomóc! 😊\n\nDaj znać, jeśli chcesz sprawdzić grafik lub zaplanować kolejne spotkanie.`
        : `You're welcome! Glad I could help! 😊\n\nLet me know if you want to check your schedule or plan another event.`,
      suggestedPrompts: lang === 'pl' 
        ? ['Kiedy mam wolne dzisiaj?', 'Co mam zaplanowane na jutro?']
        : ['When do I have free time today?', 'What is on for tomorrow?'],
    };
  }

  // 3. Conflict / overlap detection
  if (lower.includes('kolizj') || lower.includes('konflikt') || lower.includes('nakłada') || lower.includes('nakladaja') || lower.includes('conflict') || lower.includes('overlap')) {
    const conflicts: string[] = [];
    
    const byDate: Record<string, CalendarEvent[]> = {};
    events.forEach((ev) => {
      if (!byDate[ev.startDate]) byDate[ev.startDate] = [];
      byDate[ev.startDate].push(ev);
    });

    Object.entries(byDate).forEach(([dStr, dEvents]) => {
      const timed = dEvents
        .filter((e) => !e.allDay && e.startTime && e.endTime)
        .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

      for (let i = 0; i < timed.length - 1; i++) {
        const ev1 = timed[i];
        const ev2 = timed[i + 1];
        if (ev1.endTime! > ev2.startTime!) {
          conflicts.push(`• **${dStr}**: „${ev1.title}” (${ev1.startTime} - ${ev1.endTime}) ⇄ „${ev2.title}” (${ev2.startTime} - ${ev2.endTime})`);
        }
      }
    });

    if (conflicts.length === 0) {
      return {
        text: lang === 'pl'
          ? `✅ **Brak kolizji terminów!**\n\nPrzeanalizowałem Twój kalendarz — żadne wydarzenia godzinowe nie nakładają się na siebie. Wszystko jest idealnie zorganizowane.`
          : `✅ **No schedule conflicts found!**\n\nI analyzed your calendar — none of your timed events overlap. Everything is well-organized.`,
        suggestedPrompts: lang === 'pl' ? ['Kiedy mam wolne dzisiaj?', 'Podsumuj mój tydzień'] : ['Free time today?', 'Weekly summary'],
      };
    }

    return {
      text: lang === 'pl'
        ? `⚠️ **Wykryto kolizje w Twoim kalendarzu (${conflicts.length})**:\n\n${conflicts.join('\n')}`
        : `⚠️ **Detected schedule conflicts (${conflicts.length})**:\n\n${conflicts.join('\n')}`,
      suggestedPrompts: lang === 'pl' ? ['Kiedy mam wolne dzisiaj?', 'Co mam na jutro?'] : ['When am I free today?', 'What is on tomorrow?'],
    };
  }

  // 4. Free time analysis ("Kiedy mam wolne w piątek?", "Free time today?")
  if (lower.includes('wolne') || lower.includes('okienko') || lower.includes('kiedy mam czas') || lower.includes('wolny czas') || lower.includes('czy mam woln') || lower.includes('free time') || lower.includes('available')) {
    const parsed = parseDateFromNaturalLanguage(raw, now, lang);
    const targetDateStr = parsed.dateStr;
    const label = parsed.label;

    const dayEvents = events
      .filter((e) => e.startDate === targetDateStr && !e.allDay && e.startTime && e.endTime)
      .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

    if (dayEvents.length === 0) {
      return {
        text: lang === 'pl'
          ? `🟢 **${label} (${targetDateStr})** Twój grafik jest w 100% wolny!\n\nNie masz zaplanowanych żadnych spotkań godzinowych.`
          : `🟢 **${label} (${targetDateStr})** Your schedule is 100% free!\n\nYou have no scheduled timed meetings.`,
        suggestedPrompts: [
          lang === 'pl' ? `Dodaj spotkanie ${label.toLowerCase()} o 12:00` : `Add meeting ${label.toLowerCase()} at 12:00`,
          lang === 'pl' ? 'Co mam w pozostałe dni?' : 'What is on other days?',
        ],
      };
    }

    const slots: string[] = [];
    let currentMin = 8 * 60; // 08:00 AM

    dayEvents.forEach((ev) => {
      const [sh, sm] = ev.startTime!.split(':').map(Number);
      const [eh, em] = ev.endTime!.split(':').map(Number);
      const evStartMin = sh * 60 + sm;
      const evEndMin = eh * 60 + em;

      if (evStartMin > currentMin + 15) {
        const fromH = Math.floor(currentMin / 60);
        const fromM = currentMin % 60;
        const toH = Math.floor(evStartMin / 60);
        const toM = evStartMin % 60;
        const diffHours = ((evStartMin - currentMin) / 60).toFixed(1).replace('.0', '');
        slots.push(`• **${pad2(fromH)}:${pad2(fromM)} – ${pad2(toH)}:${pad2(toM)}** (${diffHours}h ${lang === 'pl' ? 'wolnego' : 'free'})`);
      }
      if (evEndMin > currentMin) {
        currentMin = evEndMin;
      }
    });

    if (currentMin < 20 * 60) {
      const fromH = Math.floor(currentMin / 60);
      const fromM = currentMin % 60;
      slots.push(`• **${lang === 'pl' ? 'od' : 'from'} ${pad2(fromH)}:${pad2(fromM)} ${lang === 'pl' ? 'do wieczora' : 'till evening'}**`);
    }

    return {
      text: lang === 'pl'
        ? `📅 **Analiza wolnego czasu (${label}, ${targetDateStr})**:\n\nMasz ${dayEvents.length} spotkań. Twoje wolne okienka:\n${slots.join('\n')}`
        : `📅 **Free time analysis (${label}, ${targetDateStr})**:\n\nYou have ${dayEvents.length} meetings. Free slots:\n${slots.join('\n')}`,
      suggestedPrompts: [
        lang === 'pl' ? `Co dokładnie mam ${label.toLowerCase()}?` : `What exactly is on ${label.toLowerCase()}?`,
        lang === 'pl' ? 'Sprawdź kolizje terminów' : 'Check for conflicts',
      ],
    };
  }

  // 5. Search specific event by term
  const searchMatch = lower.match(/(?:kiedy mam|o której mam|gdzie mam|znajdź|szukaj|when is|where is|find|search)\s+([a-ząćęłńóśźż0-9\s\-]+)/i);
  if (searchMatch && !lower.includes('wolne') && !lower.includes('czas') && !lower.includes('plan') && !lower.includes('free')) {
    const term = searchMatch[1].trim().replace(/\?$/, '');
    if (term.length >= 2) {
      const found = events.filter((e) => 
        e.title.toLowerCase().includes(term) || 
        (e.location && e.location.toLowerCase().includes(term)) ||
        (e.description && e.description.toLowerCase().includes(term))
      ).sort((a, b) => a.startDate.localeCompare(b.startDate));

      if (found.length === 0) {
        return {
          text: lang === 'pl'
            ? `🔍 Nie znalazłem w kalendarzu żadnego wpisu pasującego do: **„${term}”**.\n\nCzy chcesz dodać to spotkanie? Napisz np. *„Dodaj ${term} w piątek o 14:00”*.`
            : `🔍 Could not find any event matching: **“${term}”**.\n\nWould you like to schedule it? Try typing *“Add ${term} on Friday at 2pm”*.`,
          suggestedPrompts: [lang === 'pl' ? `Dodaj ${term} jutro o 15:00` : `Add ${term} tomorrow at 3pm`],
        };
      }

      const list = found.map((e) => {
        const timeStr = e.allDay ? (lang === 'pl' ? 'całodniowe' : 'all-day') : `${e.startTime || ''} – ${e.endTime || ''}`;
        const locStr = e.location ? ` [📍 ${e.location}]` : '';
        return `• **${e.startDate}** (${timeStr}): **${e.title}**${locStr}`;
      }).join('\n');

      return {
        text: `🔍 **${lang === 'pl' ? `Znaleziono wydarzenia pasujące do „${term}”` : `Found events matching “${term}”`} (${found.length})**:\n\n${list}`,
        suggestedPrompts: [lang === 'pl' ? 'Kiedy mam wolne dzisiaj?' : 'Free time today?', lang === 'pl' ? 'Co mam w tym tygodniu?' : 'This week plan'],
      };
    }
  }

  // 6. Summary of Week / Weekend / Month
  if (lower.includes('podsumuj') || lower.includes('tydzień') || lower.includes('tydzien') || lower.includes('summary') || lower.includes('week')) {
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);
    const in7DaysStr = formatDateISO(in7Days);

    const weekEvents = events.filter((e) => e.startDate >= todayStr && e.startDate <= in7DaysStr);

    if (weekEvents.length === 0) {
      return {
        text: lang === 'pl'
          ? `📊 **Podsumowanie nadchodzących 7 dni**: Twój grafik jest całkowicie czysty. Brak zaplanowanych wydarzeń!`
          : `📊 **7-Day Summary**: Your calendar is completely open. No scheduled events!`,
        suggestedPrompts: [lang === 'pl' ? 'Dodaj spotkanie jutro' : 'Add event tomorrow'],
      };
    }

    const previewList = weekEvents.slice(0, 6).map((e) => {
      const t = e.allDay ? (lang === 'pl' ? 'cały dzień' : 'all-day') : `${e.startTime} - ${e.endTime}`;
      return `• **${e.startDate}** (${t}): **${e.title}**`;
    }).join('\n');

    return {
      text: lang === 'pl'
        ? `📊 **Podsumowanie nadchodzącego tygodnia**:\n\nMasz zaplanowane **${weekEvents.length} wydarzeń** w ciągu najbliższych 7 dni.\n\nNajbliższe terminy:\n${previewList}`
        : `📊 **Upcoming Week Summary**:\n\nYou have **${weekEvents.length} events** scheduled over the next 7 days.\n\nUpcoming items:\n${previewList}`,
      suggestedPrompts: [lang === 'pl' ? 'Czy mam jakieś kolizje?' : 'Check for conflicts', lang === 'pl' ? 'Kiedy mam wolne jutro?' : 'Free time tomorrow?'],
    };
  }

  // 7. Schedule for specific day ("Co mam dzisiaj?", "What is on tomorrow?")
  if (
    lower.includes('co mam') || 
    lower.includes('grafik') || 
    lower.includes('mój plan') || 
    lower.includes('moj plan') || 
    lower.includes('harmonogram') ||
    lower.includes('what is on') ||
    lower.includes('schedule') ||
    lower.includes('my plan')
  ) {
    const parsed = parseDateFromNaturalLanguage(raw, now, lang);
    const targetDateStr = parsed.dateStr;
    const label = parsed.label;

    const dayEvents = events
      .filter((e) => e.startDate === targetDateStr)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

    if (dayEvents.length === 0) {
      return {
        text: lang === 'pl'
          ? `📅 **${label} (${targetDateStr})**: brak zaplanowanych wydarzeń.\n\nTwój dzień jest wolny.`
          : `📅 **${label} (${targetDateStr})**: no scheduled events.\n\nYour day is clear.`,
        suggestedPrompts: [
          lang === 'pl' ? `Dodaj spotkanie ${label.toLowerCase()} o 14:00` : `Add meeting ${label.toLowerCase()} at 2pm`,
          lang === 'pl' ? 'Kiedy mam wolne dzisiaj?' : 'Free time today?',
        ],
      };
    }

    const items = dayEvents.map((e) => {
      const timeInfo = e.allDay ? `*(${lang === 'pl' ? 'Cały dzień' : 'All day'})*` : `**${e.startTime} - ${e.endTime}**`;
      const locInfo = e.location ? ` [📍 ${e.location}]` : '';
      return `• ${timeInfo} – **${e.title}**${locInfo}`;
    }).join('\n');

    return {
      text: `📅 **${lang === 'pl' ? `Twój plan na dzień: ${label}` : `Your schedule for: ${label}`} (${targetDateStr})**:\n\n${items}`,
      suggestedPrompts: [
        lang === 'pl' ? `Kiedy mam wolne ${label.toLowerCase()}?` : `Free time ${label.toLowerCase()}?`,
        lang === 'pl' ? 'Sprawdź kolizje terminów' : 'Check for conflicts',
      ],
    };
  }

  // 8. Event Creation via NLP
  const extracted = extractEventFromPromptOffline(query, now, lang);
  if (extracted && (extracted.title.length > 2 || extracted.startTime)) {
    return {
      text: lang === 'pl'
        ? `Zrozumiałem! Przygotowałem propozycję wydarzenia **„${extracted.title}”**:\n\n• Data: **${extracted.startDate}**\n• Godzina: **${extracted.startTime ? `${extracted.startTime} – ${extracted.endTime}` : 'Cały dzień'}**${extracted.location ? `\n• Lokalizacja: **${extracted.location}**` : ''}\n• Kolor: **${extracted.color}**\n\nKliknij przycisk poniżej, aby zatwierdzić dodanie do kalendarza:`
        : `Got it! Here is the proposed event **“${extracted.title}”**:\n\n• Date: **${extracted.startDate}**\n• Time: **${extracted.startTime ? `${extracted.startTime} – ${extracted.endTime}` : 'All day'}**${extracted.location ? `\n• Location: **${extracted.location}**` : ''}\n• Color: **${extracted.color}**\n\nClick the button below to confirm:`,
      suggestedEvent: extracted,
      suggestedPrompts: lang === 'pl' ? ['Kiedy mam wolne dzisiaj?', 'Co mam w ten dzień?'] : ['Free time today?', 'What is on this day?'],
    };
  }

  // 9. Default Fallback
  return {
    text: lang === 'pl'
      ? `Rozumiem Twoją wiadomość: *„${raw}”*.\n\nJestem asystentem kalendarza działającym w 100% lokalnie. Oto co potrafię:\n\n1. **Planowanie:** *„Jutro o 16:00 dentysta na 45 minut”* lub *„Obiad w niedzielę o 14:00”*.\n2. **Wolny czas:** *„Kiedy mam wolne dzisiaj?”* lub *„Czy mam wolny czwartek?”*.\n3. **Przegląd:** *„Co mam w piątek?”* lub *„Plan na weekend”*.\n4. **Szukanie:** *„Kiedy mam spotkanie z klientem?”*.\n5. **Kolizje:** *„Czy mam jakieś kolizje w terminach?”*.`
      : `I received your message: *“${raw}”*.\n\nI am your 100% offline local calendar assistant. Here is what I can do:\n\n1. **Schedule:** *“Dentist tomorrow at 4pm for 45 mins”* or *“Dinner on Sunday at 2pm”*.\n2. **Free time:** *“When do I have free time today?”* or *“Am I free on Friday?”*.\n3. **Agenda:** *“What is on Friday?”* or *“Summary of this week”*.\n4. **Search:** *“Find doctor appointment”*.\n5. **Conflicts:** *“Check for schedule conflicts”*.`,
    suggestedPrompts: lang === 'pl'
      ? ['Kiedy mam wolne dzisiaj?', 'Co mam zaplanowane na jutro?', 'Czy mam wolny czwartek?']
      : ['When do I have free time today?', 'What is on for tomorrow?', 'Check for conflicts'],
  };
};
