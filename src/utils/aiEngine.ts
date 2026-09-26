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

// Helper to format Date to YYYY-MM-DD
export const formatDateISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

function setNextDayOfWeek(date: Date, targetDayOfWeek: number) {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentDay = date.getDay();
  let diff = targetDayOfWeek - currentDay;
  if (diff <= 0) diff += 7;
  date.setDate(date.getDate() + diff);
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
  if (lower.match(/lekarz|dentyst|badani|szpital|apteka|medyc|recept|zdrowie|piln|okulist|kardiolog/)) {
    return 'tomato'; // red
  }
  if (lower.match(/sport|trening|bieg|siłow|mecz|rower|basen|joga|fitness|spacer/)) {
    return 'sage'; // green
  }
  if (lower.match(/obiad|kolacja|randka|urodzin|imprez|rodzin|mama|tata|kino|teatr|znajomi/)) {
    return 'flamingo'; // rose
  }
  if (lower.match(/zakup|sklep|pieniądz|przelew|rachun|opłat|auto|mechanik|warsztat/)) {
    return 'tangerine'; // orange
  }
  if (lower.match(/odpoczynek|relaks|urlop|wakacje|plaża|wolne/)) {
    return 'banana'; // yellow
  }
  if (lower.match(/studia|egzamin|szkoła|lekcja|kurs|nauka|książk|szkolenie/)) {
    return 'grape'; // purple
  }
  if (lower.match(/praca|projekt|biuro|klient|call|zoom|meet|zarząd|faktura/)) {
    return 'blueberry'; // indigo
  }
  return 'peacock'; // default blue
};

/**
 * 100% Offline Local Natural Language Event Extractor (Polish & English)
 */
export const extractEventFromPromptOffline = (prompt: string, referenceDate: Date = new Date()): ExtractedEventSuggestion | null => {
  const text = prompt.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  
  // Date calculation
  let targetDate = new Date(referenceDate);
  let isAllDay = true;
  let startTime = '10:00';
  let endTime = '11:00';

  // Polish relative days
  let dateMatched = false;
  if (lower.includes('pojutrze') || lower.includes('day after tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 2);
    dateMatched = true;
  } else if (lower.includes('jutro') || lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
    dateMatched = true;
  } else if (lower.includes('dzisiaj') || lower.includes('dziś') || lower.includes('today')) {
    dateMatched = true;
  } else if (lower.includes('w poniedziałek') || lower.includes('w poniedzialek') || lower.includes('w pn')) {
    setNextDayOfWeek(targetDate, 1);
    dateMatched = true;
  } else if (lower.includes('we wtorek') || lower.includes('we wt')) {
    setNextDayOfWeek(targetDate, 2);
    dateMatched = true;
  } else if (lower.includes('w środę') || lower.includes('w srode') || lower.includes('w śr')) {
    setNextDayOfWeek(targetDate, 3);
    dateMatched = true;
  } else if (lower.includes('w czwartek') || lower.includes('w czw')) {
    setNextDayOfWeek(targetDate, 4);
    dateMatched = true;
  } else if (lower.includes('w piątek') || lower.includes('w piatek') || lower.includes('w pt')) {
    setNextDayOfWeek(targetDate, 5);
    dateMatched = true;
  } else if (lower.includes('w sobotę') || lower.includes('w sobote') || lower.includes('w sob')) {
    setNextDayOfWeek(targetDate, 6);
    dateMatched = true;
  } else if (lower.includes('w niedzielę') || lower.includes('w niedziele') || lower.includes('w nd')) {
    setNextDayOfWeek(targetDate, 0);
    dateMatched = true;
  }

  // Check specific day of month (e.g. 15 marca, 22 listopada, 2026-10-15)
  const monthNamesPl = ['stycz', 'lut', 'mar', 'kwiet', 'maj', 'czerw', 'lip', 'sierp', 'wrzes', 'paździer', 'pazdzier', 'listopad', 'grudzi'];
  for (let m = 0; m < monthNamesPl.length; m++) {
    const reg = new RegExp(`(\\d{1,2})\\s*${monthNamesPl[m]}[a-z]*`, 'i');
    const match = text.match(reg);
    if (match) {
      const dNum = parseInt(match[1], 10);
      targetDate.setMonth(m);
      targetDate.setDate(dNum);
      dateMatched = true;
      break;
    }
  }

  // Time extraction regex (e.g. o 15:30, o 14, od 10 do 12)
  const timeRangeMatch = text.match(/(?:od\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:do|-)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
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
    const hours = parseInt(singleTimeMatch[1], 10);
    const minutes = singleTimeMatch[2] ? parseInt(singleTimeMatch[2], 10) : 0;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      isAllDay = false;
      startTime = `${pad2(hours)}:${pad2(minutes)}`;
      
      const durationMatch = text.match(/(?:na|przez|trwa|for)\s*(\d+)\s*(min(?:ut)?|h|godz(?:in[yę]?)?)/i);
      let durationMinutes = 60;
      if (durationMatch) {
        const amount = parseInt(durationMatch[1], 10);
        const unit = durationMatch[2].toLowerCase();
        if (unit.startsWith('min')) {
          durationMinutes = amount;
        } else {
          durationMinutes = amount * 60;
        }
      }
      endTime = calculateEndTime(startTime, durationMinutes);
    }
  }

  // Location extraction
  let location: string | undefined;
  const locationMatch = text.match(/(?:w|we|w lokalizacji|w biurze|u|na sali)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\s\-]+?)(?=\s+(?:o|godz|od|na|jutro|pojutrze|$))/i);
  if (locationMatch && locationMatch[1].trim().length > 2) {
    const locCandidate = locationMatch[1].trim();
    if (!locCandidate.match(/^(poniedziałek|wtorek|środę|srodę|czwartek|piątek|sobotę|niedzielę|ten|ta|to)$/i)) {
      location = locCandidate;
    }
  }

  // Title extraction: remove common prefixes and filler words
  let title = text
    .replace(/^(dodaj|zaplanuj|ustaw|wpisz|utwórz|stwórz|muszę pójść do|muszę zrobić|chcę dodać|przypomnij o|przypomnij mi o)\s+/i, '')
    .replace(/(?:o|godz(?:inie|\.)?)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:od\s*)?\d{1,2}(?:[:.]\d{2})?\s*(?:do|-)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:na|przez|trwa)\s*\d+\s*(?:min(?:ut)?|h|godz(?:in[yę]?)?)/gi, '')
    .replace(/(dzisiaj|dziś|jutro|pojutrze|w ten weekend|w poniedziałek|we wtorek|w środę|w srode|w czwartek|w piątek|w piatek|w sobotę|w sobote|w niedzielę|w niedziele)/gi, '')
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
    description: `Dodane przez asystenta kalendarza: "${text}"`,
    color,
  };
};

/**
 * 100% Offline Conversational Calendar Assistant Engine
 * Potrafi odpowiadać na pytania o grafik, wolny czas, szukać wydarzeń, 
 * sprawdzać kolizje, a także odpowiadać konwersacyjnie na pytania użytkownika.
 */
export const runLocalAiAssistant = async (
  query: string,
  events: CalendarEvent[]
): Promise<{ text: string; suggestedEvent?: Partial<CalendarEvent> }> => {
  // Krótkie opóźnienie dla płynnego wrażenia pracy silnika
  await new Promise((resolve) => setTimeout(resolve, 200));

  const raw = query.trim();
  const lower = raw.toLowerCase();
  const now = new Date();
  const todayStr = formatDateISO(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);

  // 1. Powitanie i small-talk
  if (lower.match(/^(cześć|czesc|hej|siema|witaj|dzień dobry|dzien dobry|witam|hello|hi)[\s!.]*$/i)) {
    const todayEvents = events.filter((e) => e.startDate === todayStr);
    return {
      text: `Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza.\n\nNa dzisiaj masz zaplanowane **${todayEvents.length}** ${
        todayEvents.length === 1 ? 'wydarzenie' : todayEvents.length >= 2 && todayEvents.length <= 4 ? 'wydarzenia' : 'wydarzeń'
      }.\n\nW czym mogę Ci pomóc? Możesz mnie zapytać np.:\n- *„Co mam dzisiaj w planie?”*\n- *„Kiedy mam wolne dzisiaj?”*\n- *„Czy mam wolny czwartek?”*\n- *„Dodaj trening jutro o 18 na godzinę”*`,
    };
  }

  // 2. Podziękowania
  if (lower.match(/^(dzięki|dzieki|dziękuję|dziekuje|super|ekstra|dzięki wielkie|dziękuje bardzo)[\s!.]*$/i)) {
    return {
      text: `Nie ma za co, cieszę się, że mogłem pomóc! 😊 Daj znać, jeśli chcesz sprawdzić grafik lub zaplanować kolejne spotkanie.`,
    };
  }

  // 3. Sprawdzanie wolnego czasu / okienek
  if (lower.includes('wolne') || lower.includes('okienko') || lower.includes('kiedy mam czas') || lower.includes('wolny czas') || lower.includes('czy mam czas')) {
    const isTomorrow = lower.includes('jutro');
    const targetDateStr = isTomorrow ? tomorrowStr : todayStr;
    const labelDay = isTomorrow ? 'Jutro' : 'Dzisiaj';

    const dayEvents = events
      .filter((e) => e.startDate === targetDateStr && !e.allDay && e.startTime && e.endTime)
      .sort((a, b) => a.startTime!.localeCompare(b.startTime!));

    if (dayEvents.length === 0) {
      return {
        text: `🟢 **${labelDay} (${targetDateStr})** Twój grafik jest w 100% wolny! Nie masz zaplanowanych żadnych spotkań godzinowych. Masz pełną swobodę planowania.`,
      };
    }

    const slots: string[] = [];
    let currentMin = 8 * 60; // 08:00

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
      text: `📅 **Analiza wolnego czasu (${labelDay}, ${targetDateStr})**:\n\nMasz zaplanowane ${dayEvents.length} spotkań. Twoje wolne okienka:\n${slots.join('\n')}`,
    };
  }

  // 4. Sprawdzanie kolizji / nakładających się terminów
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
          conflicts.push(`• **${dStr}**: „${ev1.title}” (${ev1.startTime}-${ev1.endTime}) nakłada się na „${ev2.title}” (${ev2.startTime}-${ev2.endTime})`);
        }
      }
    });

    if (conflicts.length === 0) {
      return {
        text: `✅ **Brak kolizji terminów!**\n\nPrzeanalizowałem Twój kalendarz — żadne wydarzenia godzinowe nie nakładają się na siebie. Wszystko jest idealnie zaplanowane.`,
      };
    }

    return {
      text: `⚠️ **Wykryto kolizje w Twoim kalendarzu (${conflicts.length})**:\n\n${conflicts.join('\n')}\n\nWarto przesunąć któreś z tych spotkań, aby uniknąć spóźnienia.`,
    };
  }

  // 5. Szukanie konkretnego wydarzenia (np. "kiedy mam dentystę?", "o której mam spotkanie?")
  const searchMatch = lower.match(/(?:kiedy mam|o której mam|gdzie mam|znajdź|szukaj)\s+([a-ząćęłńóśźż0-9\s\-]+)/i);
  if (searchMatch && !lower.includes('wolne') && !lower.includes('czas')) {
    const term = searchMatch[1].trim().replace(/\?$/, '');
    if (term.length >= 3) {
      const found = events.filter((e) => 
        e.title.toLowerCase().includes(term) || 
        (e.location && e.location.toLowerCase().includes(term)) ||
        (e.description && e.description.toLowerCase().includes(term))
      ).sort((a, b) => a.startDate.localeCompare(b.startDate));

      if (found.length === 0) {
        return {
          text: `🔍 Przeszukałem Twój kalendarz i nie znalazłem żadnego wpisu pasującego do hasła **„${term}”**.\n\nCzy chcesz, abym zaplanował takie spotkanie? Wystarczy napisać np. *„Dodaj ${term} w piątek o 14”*.`,
        };
      }

      const list = found.map((e) => {
        const timeStr = e.allDay ? 'całodniowe' : `${e.startTime || ''} – ${e.endTime || ''}`;
        const locStr = e.location ? ` [${e.location}]` : '';
        return `• **${e.startDate}** (${timeStr}): **${e.title}**${locStr}`;
      }).join('\n');

      return {
        text: `🔍 **Znaleziono wydarzenia pasujące do „${term}” (${found.length})**:\n\n${list}`,
      };
    }
  }

  // 6. Zapytania o plan na dany dzień ("co mam dzisiaj?", "co mam jutro?", "jaki mam plan?")
  if (lower.includes('co mam') || lower.includes('grafik') || lower.includes('mój plan') || lower.includes('agenda') || lower.includes('harmonogram')) {
    const isTomorrow = lower.includes('jutro');
    const targetDateStr = isTomorrow ? tomorrowStr : todayStr;
    const labelDay = isTomorrow ? 'Jutro' : 'Dzisiaj';

    const dayEvents = events
      .filter((e) => e.startDate === targetDateStr)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

    if (dayEvents.length === 0) {
      return {
        text: `📅 **${labelDay} (${targetDateStr})**: brak zaplanowanych wydarzeń. Twój dzień jest czysty. Możesz odpocząć lub zaplanować coś nowego!`,
      };
    }

    const items = dayEvents.map((e) => {
      const timeInfo = e.allDay ? '*(Cały dzień)*' : `godz. **${e.startTime} - ${e.endTime}**`;
      const locInfo = e.location ? ` [${e.location}]` : '';
      return `• ${timeInfo} – **${e.title}**${locInfo}`;
    }).join('\n');

    return {
      text: `📅 **Twój plan na ${labelDay.toLowerCase()} (${targetDateStr})**:\n\n${items}`,
    };
  }

  // 7. Podsumowanie tygodnia
  if (lower.includes('podsumuj') || lower.includes('tydzień') || lower.includes('tydzien')) {
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);
    const in7DaysStr = formatDateISO(in7Days);

    const weekEvents = events.filter((e) => e.startDate >= todayStr && e.startDate <= in7DaysStr);

    if (weekEvents.length === 0) {
      return {
        text: `📊 **Podsumowanie nadchodzących 7 dni**: Twój grafik jest całkowicie wolny. Brak jakichkolwiek wydarzeń!`,
      };
    }

    return {
      text: `📊 **Podsumowanie nadchodzącego tygodnia**:\n\nŁącznie masz zaplanowane **${weekEvents.length} wydarzeń** w ciągu najbliższych 7 dni.\n\nNajbliższe terminy:\n${weekEvents.slice(0, 5).map(e => `• **${e.startDate}** (${e.allDay ? 'cały dzień' : e.startTime}): ${e.title}`).join('\n')}`,
    };
  }

  // 8. Dodawanie / planowanie nowego wydarzenia
  const extracted = extractEventFromPromptOffline(query);
  if (extracted && (extracted.title.length > 2 || extracted.startTime)) {
    return {
      text: `Zrozumiałem! Przygotowałem wydarzenie **„${extracted.title}”** na dzień **${extracted.startDate}**${
        extracted.startTime ? ` w godz. **${extracted.startTime} – ${extracted.endTime}**` : ' (całodniowe)'
      }${extracted.location ? ` w lokalizacji: *${extracted.location}*` : ''}.\n\nPrzypisałem automatycznie kolor: **${extracted.color}**.\n\nKliknij przycisk poniżej, aby zatwierdzić dodanie do kalendarza:`,
      suggestedEvent: extracted,
    };
  }

  // 9. Inteligentna odpowiedź konwersacyjna
  return {
    text: `Rozumiem Twoją wiadomość: *„${raw}”*.\n\nJestem asystentem kalendarza działającym w 100% lokalnie na Twoim urządzeniu. Oto co potrafię dla Ciebie zrobić:\n\n1. **Planowanie:** Napisz np. *„Jutro o 16:00 dentysta na 45 minut”* lub *„Obiad u mamy w niedzielę o 13:00”*.\n2. **Sprawdzanie wolnego czasu:** *„Kiedy mam wolne dzisiaj?”* lub *„Kiedy mam wolny czas jutro?”*.\n3. **Przeglądanie grafiku:** *„Co mam dzisiaj?”* lub *„Podsumuj mój tydzień”*.\n4. **Wyszukiwanie:** *„Kiedy mam lekarza?”* lub *„Znajdź spotkanie projektowe”*.\n5. **Kontrola kolizji:** *„Czy mam jakieś konflikty w terminach?”*.`,
  };
};
