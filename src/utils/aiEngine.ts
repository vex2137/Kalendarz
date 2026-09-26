import { CalendarEvent, GoogleCalendarColor } from '../types';

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

const POLISH_DAYS_MAP: { pattern: RegExp; targetDay: number; label: string }[] = [
  { pattern: /(?:w\s+|we\s+)?poniedzia[łl]ek/i, targetDay: 1, label: 'W poniedziałek' },
  { pattern: /(?:we\s+|w\s+)?wtorek/i, targetDay: 2, label: 'We wtorek' },
  { pattern: /(?:w\s+)?środ[ęe]|srod[ęe]/i, targetDay: 3, label: 'W środę' },
  { pattern: /(?:w\s+)?czwartek/i, targetDay: 4, label: 'W czwartek' },
  { pattern: /(?:w\s+)?pi[ąa]tek/i, targetDay: 5, label: 'W piątek' },
  { pattern: /(?:w\s+)?sobot[ęe]/i, targetDay: 6, label: 'W sobotę' },
  { pattern: /(?:w\s+)?niedziel[ęe]/i, targetDay: 0, label: 'W niedzielę' },
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
  if (lower.match(/lekarz|dentyst|badani|szpital|apteka|medyc|recept|zdrowie|piln|okulist|kardiolog|fizjo|rehabilit/)) {
    return 'tomato'; // red
  }
  if (lower.match(/sport|trening|bieg|siłow|mecz|rower|basen|joga|fitness|spacer|pilka|piłka|gym|tenis/)) {
    return 'sage'; // green
  }
  if (lower.match(/obiad|kolacja|randka|urodzin|imprez|rodzin|mama|tata|kino|teatr|znajomi|piwo|spotkanie ze znajomymi/)) {
    return 'flamingo'; // rose
  }
  if (lower.match(/zakup|sklep|pieniądz|przelew|rachun|opłat|auto|mechanik|warsztat|bank|poczta|kurier/)) {
    return 'tangerine'; // orange
  }
  if (lower.match(/odpoczynek|relaks|urlop|wakacje|plaża|wolne|weekend|wyjazd|chill/)) {
    return 'banana'; // yellow
  }
  if (lower.match(/studia|egzamin|szkoła|lekcja|kurs|nauka|książk|szkolenie|warsztaty|projekt|uczelnia/)) {
    return 'grape'; // purple
  }
  if (lower.match(/praca|biuro|klient|call|zoom|meet|zarząd|faktura|prezentacja|rekrutacja|sync|standup/)) {
    return 'blueberry'; // indigo
  }
  return 'peacock'; // default blue
};

/**
 * Parses target date from Polish natural language input
 */
export function parseDateFromPolish(
  text: string,
  referenceDate: Date = new Date()
): { date: Date; dateStr: string; label: string; matched: boolean } {
  const lower = text.toLowerCase();
  const target = new Date(referenceDate);

  if (lower.includes('pojutrze') || lower.includes('day after tomorrow')) {
    target.setDate(target.getDate() + 2);
    return { date: target, dateStr: formatDateISO(target), label: 'Pojutrze', matched: true };
  }

  if (lower.includes('jutro') || lower.includes('tomorrow')) {
    target.setDate(target.getDate() + 1);
    return { date: target, dateStr: formatDateISO(target), label: 'Jutro', matched: true };
  }

  if (lower.includes('dzisiaj') || lower.includes('dziś') || lower.includes('dzis') || lower.includes('today')) {
    return { date: target, dateStr: formatDateISO(target), label: 'Dzisiaj', matched: true };
  }

  // Check days of week
  for (const dayEntry of POLISH_DAYS_MAP) {
    if (dayEntry.pattern.test(lower)) {
      const nextDate = getNextDayOfWeek(referenceDate, dayEntry.targetDay);
      return { date: nextDate, dateStr: formatDateISO(nextDate), label: dayEntry.label, matched: true };
    }
  }

  // Check explicit date (e.g. 15 marca, 22 listopada, 2026-10-15)
  for (const monthItem of POLISH_MONTHS) {
    const reg = new RegExp(`(\\d{1,2})\\s*${monthItem.name}[a-ząćęłńóśźż]*`, 'i');
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

  // ISO date format YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    target.setFullYear(y, m, d);
    return { date: target, dateStr: formatDateISO(target), label: `${y}-${pad2(m + 1)}-${pad2(d)}`, matched: true };
  }

  return { date: target, dateStr: formatDateISO(target), label: 'Dzisiaj', matched: false };
}

/**
 * 100% Offline Local Natural Language Event Extractor (Polish & English)
 */
export const extractEventFromPromptOffline = (
  prompt: string,
  referenceDate: Date = new Date()
): ExtractedEventSuggestion | null => {
  const text = prompt.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  
  // Date calculation
  const parsedDate = parseDateFromPolish(text, referenceDate);
  const targetDate = parsedDate.date;
  let isAllDay = true;
  let startTime = '10:00';
  let endTime = '11:00';

  // Time range regex (e.g. od 15:30 do 17:00, 14:00 - 15:00, od 10 do 12)
  const timeRangeMatch = text.match(/(?:od\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:do|-)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
  // Single time regex (e.g. o 18, o 18:30, godzina 15, o 9:00 rano)
  const singleTimeMatch = text.match(/(?:o|godz(?:inie|\.)?|at)\s*(\d{1,2})(?:[:.](\d{2}))?/i) || 
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

    // Handle "rano" or "wieczorem" if user says "o 8 rano" or "o 7 wieczorem"
    if (lower.includes('wieczorem') && hours < 12) {
      hours += 12;
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      isAllDay = false;
      startTime = `${pad2(hours)}:${pad2(minutes)}`;
      
      // Duration extraction (e.g. na 45 minut, na pół godziny, na 2 godziny)
      let durationMinutes = 60;
      if (lower.match(/na\s+p[óo][łl]\s+godziny/)) {
        durationMinutes = 30;
      } else if (lower.match(/na\s+p[óo][łl]torej\s+godziny/)) {
        durationMinutes = 90;
      } else {
        const durationMatch = text.match(/(?:na|przez|trwa|for)\s*(\d+)\s*(min(?:ut)?|h|godz(?:in[yę]?)?)/i);
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
  const locationMatch = text.match(/(?:w|we|w lokalizacji|w biurze|u|na sali|na)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\s\-]+?)(?=\s+(?:o|godz|od|na|jutro|pojutrze|$))/i);
  if (locationMatch && locationMatch[1].trim().length > 2) {
    const locCandidate = locationMatch[1].trim();
    if (!locCandidate.match(/^(poniedziałek|wtorek|środę|srodę|czwartek|piątek|sobotę|niedzielę|ten|ta|to|weekend)$/i)) {
      location = locCandidate;
    }
  }

  // Title extraction: remove common prefixes and filler words
  let title = text
    .replace(/^(dodaj|zaplanuj|ustaw|wpisz|utwórz|stwórz|muszę pójść do|muszę zrobić|chcę dodać|przypomnij o|przypomnij mi o|mam)\s+/i, '')
    .replace(/(?:o|godz(?:inie|\.)?)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:od\s*)?\d{1,2}(?:[:.]\d{2})?\s*(?:do|-)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:na|przez|trwa)\s*(?:p[óo][łl]\s+godziny|p[óo][łl]torej\s+godziny|\d+\s*(?:min(?:ut)?|h|godz(?:in[yę]?)?))/gi, '')
    .replace(/(dzisiaj|dziś|jutro|pojutrze|w ten weekend|w ten piątek|w najbliższy piątek|w poniedziałek|we wtorek|w środę|w srode|w czwartek|w piątek|w piatek|w sobotę|w sobote|w niedzielę|w niedziele|w weekend)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = 'Nowe spotkanie';
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
    description: `Dodane przez lokalnego asystenta: "${text}"`,
    color,
  };
};

/**
 * 100% Offline Conversational Calendar Assistant Engine
 * Obsługuje:
 * - Sprawdzanie grafiku na DOWOLNY dzień (dzisiaj, jutro, pojutrze, w piątek, w czwartek, w weekend itp.)
 * - Analizę wolnego czasu i okienek godzinowych
 * - Wyszukiwanie wydarzeń po nazwie / osobie / miejscu
 * - Wykrywanie kolizji i nakładających się terminów
 * - Planowanie nowych terminów w języku polskim
 * - Odwoływanie i kasowanie wydarzeń
 * - Podsumowania tygodniowe i miesięczne
 */
export const runLocalAiAssistant = async (
  query: string,
  events: CalendarEvent[]
): Promise<AiResponseResult> => {
  // Płynna mikro-pauza imitująca analizę silnika NLP
  await new Promise((resolve) => setTimeout(resolve, 150));

  const raw = query.trim();
  const lower = raw.toLowerCase();
  const now = new Date();
  const todayStr = formatDateISO(now);

  // 1. Powitania i small-talk
  if (lower.match(/^(cześć|czesc|hej|siema|witaj|dzień dobry|dzien dobry|witam|hello|hi)[\s!.]*$/i)) {
    const todayEvents = events.filter((e) => e.startDate === todayStr);
    const count = todayEvents.length;
    const form = count === 1 ? 'wydarzenie' : count >= 2 && count <= 4 ? 'wydarzenia' : 'wydarzeń';

    return {
      text: `Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza.\n\nNa dzisiaj masz zaplanowane **${count}** ${form}.\n\nW czym mogę Ci pomóc? Możesz mnie zapytać np.:\n• *„Co mam dzisiaj w planie?”*\n• *„Kiedy mam wolne dzisiaj?”*\n• *„Czy mam wolny czwartek?”*\n• *„Dodaj trening jutro o 18 na godzinę”*`,
      suggestedPrompts: [
        'Co mam dzisiaj w planie?',
        'Kiedy mam wolne dzisiaj?',
        'Czy mam wolny czwartek?',
        'Sprawdź kolizje terminów',
      ],
    };
  }

  // 2. Podziękowania i reakcje
  if (lower.match(/^(dzięki|dzieki|dziękuję|dziekuje|super|ekstra|dzięki wielkie|dziękuje bardzo|świetnie|ok)[\s!.]*$/i)) {
    return {
      text: `Nie ma za co, cieszę się, że mogłem pomóc! 😊\n\nDaj znać, jeśli chcesz sprawdzić wolny czas lub zaplanować kolejne spotkanie.`,
      suggestedPrompts: ['Kiedy mam wolne dzisiaj?', 'Co mam zaplanowane na jutro?'],
    };
  }

  // 3. Sprawdzanie kolizji / nakładających się terminów
  if (lower.includes('kolizj') || lower.includes('konflikt') || lower.includes('nakłada') || lower.includes('nakladaja')) {
    const conflicts: string[] = [];
    
    // Group events by date
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
          conflicts.push(`• **${dStr}**: „${ev1.title}” (${ev1.startTime} - ${ev1.endTime}) nakłada się na „${ev2.title}” (${ev2.startTime} - ${ev2.endTime})`);
        }
      }
    });

    if (conflicts.length === 0) {
      return {
        text: `✅ **Brak kolizji terminów!**\n\nPrzeanalizowałem Twój kalendarz — żadne wydarzenia godzinowe nie nakładają się na siebie. Wszystko jest idealnie zorganizowane.`,
        suggestedPrompts: ['Kiedy mam wolne dzisiaj?', 'Podsumuj mój nadchodzący tydzień'],
      };
    }

    return {
      text: `⚠️ **Wykryto kolizje w Twoim kalendarzu (${conflicts.length})**:\n\n${conflicts.join('\n')}\n\nWarto przesunąć któreś z tych spotkań, aby uniknąć nakładania się terminów.`,
      suggestedPrompts: ['Kiedy mam wolne dzisiaj?', 'Co mam zaplanowane na jutro?'],
    };
  }

  // 4. Kasowanie / Usuwanie wydarzenia ("usuń spotkanie...", "odwołaj wizytę...")
  if (lower.startsWith('usuń') || lower.startsWith('usun') || lower.startsWith('skasuj') || lower.startsWith('odwołaj') || lower.startsWith('odwolaj')) {
    const term = lower
      .replace(/^(usuń|usun|skasuj|odwołaj|odwolaj)\s+(wydarzenie|spotkanie|termin|wizytę|wizyte)?\s*/i, '')
      .trim();

    if (term.length >= 2) {
      const match = events.find((e) => e.title.toLowerCase().includes(term));
      if (match) {
        return {
          text: `Znalazłem wydarzenie **„${match.title}”** w dniu **${match.startDate}** (${match.allDay ? 'cały dzień' : `${match.startTime} - ${match.endTime}`}).\n\nMożesz je usunąć klikając ikonę edycji w kalendarzu lub otwierając szczegóły tego dnia.`,
          eventToDelete: match,
          suggestedPrompts: ['Co mam dzisiaj w planie?', 'Sprawdź wolny czas dzisiaj'],
        };
      }
    }
  }

  // 5. Sprawdzanie wolnego czasu / okienek godzinowych ("Kiedy mam wolne w piątek?", "Czy mam wolny czwartek?")
  if (lower.includes('wolne') || lower.includes('okienko') || lower.includes('kiedy mam czas') || lower.includes('wolny czas') || lower.includes('czy mam woln') || lower.includes('czy mam czas')) {
    const parsed = parseDateFromPolish(raw, now);
    const targetDateStr = parsed.dateStr;
    const label = parsed.label;

    const dayEvents = events
      .filter((e) => e.startDate === targetDateStr && !e.allDay && e.startTime && e.endTime)
      .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

    if (dayEvents.length === 0) {
      return {
        text: `🟢 **${label} (${targetDateStr})** Twój grafik jest w 100% wolny!\n\nNie masz zaplanowanych żadnych spotkań godzinowych. Masz pełną swobodę w planowaniu zadań i odpoczynku.`,
        suggestedPrompts: [
          `Dodaj spotkanie ${label.toLowerCase()} o 12:00`,
          'Co mam w pozostałe dni tygodnia?',
        ],
      };
    }

    const slots: string[] = [];
    let currentMin = 8 * 60; // Start analyzing from 08:00 AM

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
        slots.push(`• **${pad2(fromH)}:${pad2(fromM)} – ${pad2(toH)}:${pad2(toM)}** (${diffHours} godz. wolnego)`);
      }
      if (evEndMin > currentMin) {
        currentMin = evEndMin;
      }
    });

    if (currentMin < 20 * 60) {
      const fromH = Math.floor(currentMin / 60);
      const fromM = currentMin % 60;
      slots.push(`• **od ${pad2(fromH)}:${pad2(fromM)} do wieczora**`);
    }

    return {
      text: `📅 **Analiza wolnego czasu (${label}, ${targetDateStr})**:\n\nMasz zaplanowane ${dayEvents.length} spotkań. Twoje wolne okienka w ciągu dnia:\n${slots.join('\n')}`,
      suggestedPrompts: [
        `Co dokładnie mam zaplanowane ${label.toLowerCase()}?`,
        'Sprawdź kolizje terminów',
      ],
    };
  }

  // 6. Szukanie konkretnego wydarzenia (np. "kiedy mam dentystę?", "szukaj trening")
  const searchMatch = lower.match(/(?:kiedy mam|o której mam|gdzie mam|znajdź|szukaj)\s+([a-ząćęłńóśźż0-9\s\-]+)/i);
  if (searchMatch && !lower.includes('wolne') && !lower.includes('czas') && !lower.includes('plan')) {
    const term = searchMatch[1].trim().replace(/\?$/, '');
    if (term.length >= 2) {
      const found = events.filter((e) => 
        e.title.toLowerCase().includes(term) || 
        (e.location && e.location.toLowerCase().includes(term)) ||
        (e.description && e.description.toLowerCase().includes(term))
      ).sort((a, b) => a.startDate.localeCompare(b.startDate));

      if (found.length === 0) {
        return {
          text: `🔍 Przeszukałem Twój kalendarz i nie znalazłem żadnego wpisu pasującego do hasła **„${term}”**.\n\nCzy chcesz, abym zaplanował takie spotkanie? Wystarczy napisać np. *„Dodaj ${term} w piątek o 14:00”*.`,
          suggestedPrompts: [`Dodaj ${term} jutro o 15:00`, 'Co mam dzisiaj w planie?'],
        };
      }

      const list = found.map((e) => {
        const timeStr = e.allDay ? 'całodniowe' : `${e.startTime || ''} – ${e.endTime || ''}`;
        const locStr = e.location ? ` [📍 ${e.location}]` : '';
        return `• **${e.startDate}** (${timeStr}): **${e.title}**${locStr}`;
      }).join('\n');

      return {
        text: `🔍 **Znaleziono wydarzenia pasujące do „${term}” (${found.length})**:\n\n${list}`,
        suggestedPrompts: ['Kiedy mam wolne dzisiaj?', 'Co mam w tym tygodniu?'],
      };
    }
  }

  // 7. Weekend: "Co mam w weekend?", "Plan na weekend"
  if (lower.includes('weekend')) {
    // Find upcoming Saturday and Sunday
    const sat = getNextDayOfWeek(now, 6);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    const satStr = formatDateISO(sat);
    const sunStr = formatDateISO(sun);

    const weekendEvents = events
      .filter((e) => e.startDate === satStr || e.startDate === sunStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''));

    if (weekendEvents.length === 0) {
      return {
        text: `🌴 **Twój weekend (${satStr} – ${sunStr})** jest całkowicie wolny!\n\nNie masz żadnych zaplanowanych obowiązków ani spotkań. Czas na odpoczynek i regenerację.`,
        suggestedPrompts: ['Co mam w poniedziałek?', 'Podsumuj mój tydzień'],
      };
    }

    const items = weekendEvents.map((e) => {
      const dayLabel = e.startDate === satStr ? 'Sobota' : 'Niedziela';
      const timeStr = e.allDay ? 'cały dzień' : `godz. ${e.startTime} - ${e.endTime}`;
      return `• **${dayLabel} (${e.startDate})** [${timeStr}]: **${e.title}**`;
    }).join('\n');

    return {
      text: `🌴 **Plan na nadchodzący weekend (${satStr} – ${sunStr})**:\n\n${items}`,
      suggestedPrompts: ['Kiedy mam wolne w sobotę?', 'Co mam w poniedziałek?'],
    };
  }

  // 8. Podsumowanie tygodnia: "Podsumuj tydzień", "Co mam w tym tygodniu?"
  if (lower.includes('podsumuj') || lower.includes('tydzień') || lower.includes('tydzien')) {
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);
    const in7DaysStr = formatDateISO(in7Days);

    const weekEvents = events.filter((e) => e.startDate >= todayStr && e.startDate <= in7DaysStr);

    if (weekEvents.length === 0) {
      return {
        text: `📊 **Podsumowanie nadchodzących 7 dni**: Twój grafik jest całkowicie wolny. Brak jakichkolwiek wydarzeń!`,
        suggestedPrompts: ['Dodaj nowe spotkanie na jutro', 'Co mam w planie?'],
      };
    }

    const previewList = weekEvents.slice(0, 6).map((e) => {
      const t = e.allDay ? 'cały dzień' : `${e.startTime} - ${e.endTime}`;
      return `• **${e.startDate}** (${t}): **${e.title}**`;
    }).join('\n');

    return {
      text: `📊 **Podsumowanie nadchodzącego tygodnia**:\n\nŁącznie masz zaplanowane **${weekEvents.length} wydarzeń** w ciągu najbliższych 7 dni.\n\nNajbliższe terminy:\n${previewList}`,
      suggestedPrompts: ['Czy mam jakieś kolizje?', 'Kiedy mam wolne jutro?'],
    };
  }

  // 9. Zapytanie o plan na DOWOLNY dzień ("co mam w czwartek?", "grafik na piątek", "co mam jutro?", "co mam dzisiaj?")
  if (
    lower.includes('co mam') || 
    lower.includes('grafik') || 
    lower.includes('mój plan') || 
    lower.includes('moj plan') || 
    lower.includes('harmonogram') ||
    lower.includes('agenda') ||
    lower.includes('co robię') ||
    lower.includes('co robie')
  ) {
    const parsed = parseDateFromPolish(raw, now);
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
        text: `📅 **${label} (${targetDateStr})**: brak zaplanowanych wydarzeń.\n\nTwój dzień jest czysty. Możesz odpocząć lub zaplanować coś nowego!`,
        suggestedPrompts: [
          `Dodaj spotkanie ${label.toLowerCase()} o 14:00`,
          'Kiedy mam wolne dzisiaj?',
        ],
      };
    }

    const items = dayEvents.map((e) => {
      const timeInfo = e.allDay ? '*(Cały dzień)*' : `godz. **${e.startTime} - ${e.endTime}**`;
      const locInfo = e.location ? ` [📍 ${e.location}]` : '';
      return `• ${timeInfo} – **${e.title}**${locInfo}`;
    }).join('\n');

    return {
      text: `📅 **Twój plan na dzień: ${label} (${targetDateStr})**:\n\n${items}`,
      suggestedPrompts: [
        `Kiedy mam wolne ${label.toLowerCase()}?`,
        'Sprawdź kolizje terminów',
      ],
    };
  }

  // 10. Dodawanie / planowanie nowego wydarzenia ze zdania (NLP)
  const extracted = extractEventFromPromptOffline(query);
  if (extracted && (extracted.title.length > 2 || extracted.startTime)) {
    return {
      text: `Zrozumiałem! Przygotowałem propozycję wydarzenia **„${extracted.title}”**:\n\n• Data: **${extracted.startDate}**\n• Godzina: **${extracted.startTime ? `${extracted.startTime} – ${extracted.endTime}` : 'Cały dzień'}**${extracted.location ? `\n• Lokalizacja: **${extracted.location}**` : ''}\n• Kategoria koloru: **${extracted.color}**\n\nKliknij przycisk poniżej, aby zatwierdzić dodanie do kalendarza:`,
      suggestedEvent: extracted,
      suggestedPrompts: ['Kiedy mam wolne dzisiaj?', 'Co mam w ten dzień?'],
    };
  }

  // 11. Domyślna odpowiedź ze wskazówkami
  return {
    text: `Rozumiem Twoją wiadomość: *„${raw}”*.\n\nJestem asystentem kalendarza działającym w 100% lokalnie i bez sieci. Oto w czym mogę Ci pomóc:\n\n1. **Planowanie:** Napisz np. *„Jutro o 16:00 dentysta na 45 minut”* lub *„Obiad w niedzielę o 14:00”*.\n2. **Sprawdzanie wolnego czasu:** *„Kiedy mam wolne dzisiaj?”* lub *„Czy mam wolny czwartek?”*.\n3. **Przeglądanie grafiku:** *„Co mam w piątek?”* lub *„Plan na weekend”*.\n4. **Wyszukiwanie:** *„Kiedy mam lekarza?”* lub *„Znajdź trening”*.\n5. **Kontrola kolizji:** *„Czy mam jakieś kolizje w terminach?”*.`,
    suggestedPrompts: [
      'Kiedy mam wolne dzisiaj?',
      'Co mam zaplanowane na jutro?',
      'Czy mam wolny czwartek?',
      'Czy mam jakieś kolizje?',
    ],
  };
};
