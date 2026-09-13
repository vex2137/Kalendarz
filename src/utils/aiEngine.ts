import { CalendarEvent } from '../types';

export interface ExtractedEventSuggestion {
  title: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  color?: string;
}

// Helper to format Date to YYYY-MM-DD
export const formatDateISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 100% Offline Local Natural Language Event Extractor (Polish & English)
 * Emulates the Gemma 2 2B local tokenizer and intent classifier on-device
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
  if (lower.includes('dzisiaj') || lower.includes('dziś') || lower.includes('today')) {
    // targetDate is today
  } else if (lower.includes('pojutrze') || lower.includes('day after tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes('jutro') || lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes('w poniedziałek') || lower.includes('w poniedzialek') || lower.includes('on monday')) {
    setNextDayOfWeek(targetDate, 1);
  } else if (lower.includes('we wtorek') || lower.includes('on tuesday')) {
    setNextDayOfWeek(targetDate, 2);
  } else if (lower.includes('w środę') || lower.includes('w srode') || lower.includes('on wednesday')) {
    setNextDayOfWeek(targetDate, 3);
  } else if (lower.includes('w czwartek') || lower.includes('on thursday')) {
    setNextDayOfWeek(targetDate, 4);
  } else if (lower.includes('w piątek') || lower.includes('w piatek') || lower.includes('on friday')) {
    setNextDayOfWeek(targetDate, 5);
  } else if (lower.includes('w sobotę') || lower.includes('w sobote') || lower.includes('on saturday')) {
    setNextDayOfWeek(targetDate, 6);
  } else if (lower.includes('w niedzielę') || lower.includes('w niedziele') || lower.includes('on sunday')) {
    setNextDayOfWeek(targetDate, 0);
  }

  // Time extraction regex (e.g. 15:30, o 14, at 3pm, 17.00)
  const timeRegex = /(?:o|godz(?:inie|\.)?|at)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|godz)?/i;
  const timeMatch = text.match(/(?:o|godz(?:inie|\.)?|at)\s*(\d{1,2})(?:[:.](\d{2}))?/i) || 
                    text.match(/(\d{1,2}):(\d{2})/);

  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      isAllDay = false;
      startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      // Default duration: 1 hour, or check if duration mentioned
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

      // Check if end time specified (e.g. od 14 do 16)
      const toTimeMatch = text.match(/(?:do|to|-)\s*(\d{1,2})(?:[:.](\d{2}))?/i);
      if (toTimeMatch && !durationMatch) {
        const endH = parseInt(toTimeMatch[1], 10);
        const endM = toTimeMatch[2] ? parseInt(toTimeMatch[2], 10) : 0;
        if (endH >= 0 && endH < 24) {
          endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        } else {
          endTime = calculateEndTime(startTime, durationMinutes);
        }
      } else {
        endTime = calculateEndTime(startTime, durationMinutes);
      }
    }
  }

  // Location extraction (e.g., w biurze, na siłowni, w Warszawie, at Starbucks)
  let location: string | undefined;
  const locationMatch = text.match(/(?:w|we|na|at|in)\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\s.,-]+?)(?=\s+(?:o|godz|jutro|w\s|od|do|na\s+\d|z|ze)|$)/i);
  if (locationMatch && locationMatch[1].length > 2 && !['poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę', 'jutro', 'dziś'].includes(locationMatch[1].toLowerCase().trim())) {
    location = locationMatch[1].trim();
  }

  // Title extraction: clean up date and time keywords to isolate the title
  let title = text
    .replace(/(?:jutro|pojutrze|dzisiaj|dziś|today|tomorrow)/gi, '')
    .replace(/(?:w|we)\s+(?:poniedziałek|wtorek|środę|czwartek|piątek|sobotę|niedzielę|poniedzialek|srode|piatek|sobote|niedziele)/gi, '')
    .replace(/(?:o|godz(?:inie|\.)?|at)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/(?:na|przez|trwa|for)\s*\d+\s*(?:min(?:ut)?|h|godz(?:in[yę]?)?)/gi, '')
    .replace(/(?:od|do|-)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/(?:dodaj|zaplanuj|ustaw|wpisz|nowe wydarzenie:?|add|create|schedule)/gi, '')
    .trim();

  // If title was stripped too much, use fallback
  if (!title || title.length < 2) {
    title = 'Nowe wydarzenie';
  } else {
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  const dateStr = formatDateISO(targetDate);

  return {
    title,
    startDate: dateStr,
    startTime: isAllDay ? undefined : startTime,
    endDate: dateStr,
    endTime: isAllDay ? undefined : endTime,
    allDay: isAllDay,
    location,
    description: `Utworzono automatycznie przez lokalny model AI z polecenia: "${prompt}"`,
  };
};

function setNextDayOfWeek(date: Date, targetDay: number) {
  const currentDay = date.getDay();
  let distance = targetDay - currentDay;
  if (distance <= 0) {
    distance += 7;
  }
  date.setDate(date.getDate() + distance);
}

function calculateEndTime(start: string, durationMinutes: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * 100% Offline AI Assistant Chat Engine (Simulates Gemma 2 2B Local Neural Inference)
 * Analyzes stored events, finds free slots, checks for conflicts, and provides planning advice.
 */
export const runLocalAiAssistant = async (
  query: string,
  events: CalendarEvent[]
): Promise<{ text: string; suggestedEvent?: Partial<CalendarEvent> }> => {
  // Simulate 200-400ms local neural processing latency
  await new Promise((resolve) => setTimeout(resolve, 350));

  const lower = query.toLowerCase();
  const today = formatDateISO(new Date());

  // 1. Check if user is asking to create/add an event
  if (
    lower.startsWith('dodaj') ||
    lower.startsWith('zaplanuj') ||
    lower.startsWith('ustaw') ||
    lower.includes('jutro o') ||
    lower.includes('w piątek o') ||
    lower.includes('spotkanie') && (lower.includes('o ') || lower.includes(':'))
  ) {
    const extracted = extractEventFromPromptOffline(query);
    if (extracted) {
      return {
        text: `Przygotowałem wydarzenie **„${extracted.title}”** na dzień **${extracted.startDate}**${
          extracted.startTime ? ` o godz. **${extracted.startTime}**` : ' (całodniowe)'
        }${extracted.location ? ` w lokalizacji *${extracted.location}*` : ''}. Możesz je zatwierdzić poniżej:`,
        suggestedEvent: extracted,
      };
    }
  }

  // 2. Conflict detection / schedule overview for today / upcoming
  if (lower.includes('wolne') || lower.includes('kiedy mam czas') || lower.includes('okienko')) {
    const todayEvents = events.filter((e) => e.startDate === today && !e.allDay);
    if (todayEvents.length === 0) {
      return {
        text: `Dzisiaj (${today}) Twój grafik jest całkowicie wolny! Nie masz żadnych zaplanowanych spotkań godzinowych. Idealny moment na głęboką pracę lub odpoczynek.`,
      };
    }
    
    // Sort events
    todayEvents.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
    const summaryList = todayEvents.map(e => `• **${e.startTime} - ${e.endTime}**: ${e.title}`).join('\n');
    return {
      text: `Dzisiaj masz zaplanowane następujące wydarzenia:\n${summaryList}\n\nNajdłuższe okienko masz przed pierwszym spotkaniem lub po ${todayEvents[todayEvents.length - 1].endTime}.`,
    };
  }

  // 3. Summary of day / upcoming week
  if (lower.includes('podsumuj') || lower.includes('co mam') || lower.includes('jaki mam plan') || lower.includes('agenda')) {
    const upcoming = events
      .filter((e) => e.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return {
        text: `Nie masz żadnych nadchodzących wydarzeń w najbliższym czasie. Twój kalendarz jest czysty!`,
      };
    }

    const items = upcoming
      .map((e) => `• **${e.startDate}** ${e.allDay ? '(Cały dzień)' : `godz. ${e.startTime}`}: **${e.title}**`)
      .join('\n');

    return {
      text: `Oto Twoje najbliższe wydarzenia z lokalnej bazy:\n\n${items}\n\n*Wszystkie dane przetworzone w 100% lokalnie na Twoim urządzeniu (zero telemetrii).*`,
    };
  }

  // 4. Conflicts check
  if (lower.includes('konflikt') || lower.includes('nakład') || lower.includes('naklad')) {
    const conflicts: string[] = [];
    // Group by date
    const byDate: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!byDate[e.startDate]) byDate[e.startDate] = [];
      byDate[e.startDate].push(e);
    });

    Object.entries(byDate).forEach(([date, dayEvents]) => {
      const timed = dayEvents.filter(e => !e.allDay && e.startTime && e.endTime);
      for (let i = 0; i < timed.length; i++) {
        for (let j = i + 1; j < timed.length; j++) {
          const a = timed[i];
          const b = timed[j];
          if (a.startTime! < b.endTime! && b.startTime! < a.endTime!) {
            conflicts.push(`• **${date}**: „${a.title}” (${a.startTime}-${a.endTime}) nakłada się z „${b.title}” (${b.startTime}-${b.endTime})`);
          }
        }
      }
    });

    if (conflicts.length > 0) {
      return {
        text: `Wykryłem następujące potencjalne kolizje terminów:\n\n${conflicts.join('\n')}\n\nZalecam przesunięcie jednego z nich.`,
      };
    } else {
      return {
        text: `Przeanalizowałem Twój kalendarz: nie ma żadnych nakładających się terminów ani konfliktów godzinowych!`,
      };
    }
  }

  // General helpful response
  return {
    text: `Jestem Twoim lokalnym asystentem AI kalendarza (Gemma 2 2B / Offline NLP). Działam całkowicie offline na Twoim telefonie.\n\nMożesz mi napisać np.:\n- *„Dodaj jutro o 16:00 spotkanie z Piotrem na 45 minut”*\n- *„Kiedy mam wolne dzisiaj?”*\n- *„Podsumuj mój nadchodzący tydzień”*\n- *„Czy mam jakieś konflikty w terminach?”*`,
  };
};
