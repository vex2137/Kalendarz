import { tr } from './i18n';
import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { addDays, localDate, timeString, isValidTime } from './dates';
import { buildEventIndex } from './recurrence';

export interface AssistantPlan {
  kind: 'create' | 'move';
  events: Partial<CalendarEvent>[];
  originals: CalendarEvent[];
}
export const DEFAULT_PLANNING: PlanningPreferences = {
  dayStart: '08:00', dayEnd: '20:00', workingDays: [1, 2, 3, 4, 5], bufferMinutes: 0,
};
export function planningPreferences(value?: Partial<PlanningPreferences>): PlanningPreferences {
  const p = { ...DEFAULT_PLANNING, ...value };
  return {
    dayStart: isValidTime(p.dayStart) ? p.dayStart : DEFAULT_PLANNING.dayStart,
    dayEnd: isValidTime(p.dayEnd) && p.dayEnd > p.dayStart ? p.dayEnd : (p.dayStart < DEFAULT_PLANNING.dayEnd ? DEFAULT_PLANNING.dayEnd : '23:59'),
    workingDays: Array.isArray(p.workingDays) ? p.workingDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : DEFAULT_PLANNING.workingDays,
    bufferMinutes: Number.isInteger(p.bufferMinutes) && p.bufferMinutes >= 0 && p.bufferMinutes <= 180 ? p.bufferMinutes : 0,
  };
}
export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export function requestedDuration(text: string): number | undefined {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*[- ]?\s*(minut\p{L}*|minutes?|mins?|godzin(?:a|ę|e|y)?|hours?|h)(?!\p{L})/iu);
  if (m) return Math.round(Number(m[1].replace(',', '.')) * (/^min/i.test(m[2]) ? 1 : 60));
  if (/pół godziny|pol godziny|half an hour/i.test(text)) return 30;
  if (/godzin(?:ę|e|ne|ny|nych)|one[- ]hour|an hour/i.test(text)) return 60;
  return undefined;
}
export function availableSlots(events: CalendarEvent[], start: string, end: string, duration: number, prefs: PlanningPreferences, now: Date) {
  if (duration <= 0 || duration > 1440) return [];
  const index = buildEventIndex(events.filter(e => !e.id.startsWith('pl-holiday-')), start, end);
  const slots: { date: string; start: number; end: number }[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (!prefs.workingDays.includes(new Date(`${date}T12:00:00`).getDay())) continue;
    let cursor = Math.max(minutes(prefs.dayStart), date === localDate(now) ? now.getHours() * 60 + now.getMinutes() + (now.getSeconds() ? 1 : 0) : 0);
    const limit = minutes(prefs.dayEnd);
    if (date < localDate(now)) continue;
    for (const o of index.get(date) || []) {
      const from = o.event.allDay ? 0 : o.startMinutes - prefs.bufferMinutes;
      const to = o.event.allDay ? 1440 : o.endMinutes + prefs.bufferMinutes;
      if (Math.min(from, limit) - cursor >= duration) slots.push({ date, start: cursor, end: Math.min(from, limit) });
      cursor = Math.max(cursor, to);
    }
    if (limit - cursor >= duration) slots.push({ date, start: cursor, end: limit });
  }
  return slots;
}
export const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
function stem(word: string) {
  if (/^(?:dent(?:yst|ist)|стоматолог|дантист)/.test(word)) return 'dentist';
  if (/^(trening|workout|train|трениров)/.test(word)) return 'workout';
  if (/^(spotkan|meet|встреч)/.test(word)) return 'meeting';
  if (/[а-я]/.test(word) && word.length > 4) return word.replace(/(?:ами|ями|ого|ему|ом|ем|а|я|ы|и|у|ю|е)$/, '');
  if (word.length > 4) return word.replace(/(?:ami|ach|owie|ego|iem|em|ing|ers|es|ow|ie|a|e|y|i|s)$/, '');
  return word;
}
export function searchCalendar(events: CalendarEvent[], query: string) {
  const stop = new Set(['z', 'ze', 'w', 'we', 'na', 'o', 'the', 'a', 'an', 'with', 'my', 'for', 'с', 'со', 'в', 'на', 'у']);
  const terms = (normalize(query).match(/[\p{L}\p{N}]+/gu) || []).filter(t => !stop.has(t)).map(stem);
  if (!terms.length) return [];
  return events.filter(e => {
    const words = (normalize([e.title, e.location, e.description].filter(Boolean).join(' ')).match(/[\p{L}\p{N}]+/gu) || []).map(stem);
    return terms.every(t => words.some(w => w === t));
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''));
}
export function planningRange(text: string, now: Date): [string, string] {
  const today = localDate(now);
  if (/next week|przysz\p{L}* tygod|nast\p{L}* tygod/iu.test(text)) {
    const monday = addDays(today, 7 - ((now.getDay() + 6) % 7));
    return [monday, addDays(monday, 6)];
  }
  if (/this week|tym tygodniu/i.test(text)) return [today, addDays(today, 6 - ((now.getDay() + 6) % 7))];
  return [today, addDays(today, 13)];
}
export function planGroup(text: string, events: CalendarEvent[], prefs: PlanningPreferences, now: Date, lang: AppLanguage): { text: string; suggestedPlan?: AssistantPlan } | undefined {
  if (!/^(?:zaplanuj|rozplanuj|schedule|plan)\s/i.test(text)) return;
  const countMatch = normalize(text).match(/\b(\d+|dwa|dwie|trzy|cztery|piec|two|three|four|five)\b/);
  if (!countMatch) return;
  const counts: Record<string, number> = { dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, two: 2, three: 3, four: 4, five: 5 };
  const count = counts[countMatch[1]] || Number(countMatch[1]);
  if (count < 2) return;
  const duration = requestedDuration(text);
  if (!duration || duration < 1 || duration > 1440 || count > 20) return { text: tr(lang, 'Podaj 2–20 wydarzeń i długość każdego, np. „Zaplanuj trzy godzinne treningi w przyszłym tygodniu”.', 'Specify 2–20 events and their duration, e.g. “Schedule three one-hour workouts next week”.') };
  const [start, end] = planningRange(text, now);
  const slots = availableSlots(events, start, end, duration, prefs, now);
  // One session per day; the complete batch is proposed or nothing is proposed.
  const days = [...new Set(slots.map(s => s.date))];
  if (days.length < count) return { text: tr(lang, `Brakuje wolnych dni na ${count} wydarzeń (${start} – ${end}). Zmień zakres godzin lub dni w ustawieniach asystenta.`, `There are not enough available days for ${count} events (${start} – ${end}). Adjust the assistant's preferred hours or days.`) };
  let title = text.replace(/^(?:zaplanuj|rozplanuj|schedule|plan)\s+/i, '').replace(countMatch[0], '').replace(/(?:\d+(?:[.,]\d+)?\s*[- ]?\s*(?:minut\p{L}*|minutes?|mins?|godzin(?:a|ę|e|y)?|hours?|h)|godzinne|godzinnych|one[- ]hour)/giu, '').replace(/(?:w przyszłym tygodniu|w przyszlym tygodniu|w tym tygodniu|next week|this week|for|na)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (/^трениров/i.test(title)) title = 'Тренировка';
  if (/trening|workout/i.test(title)) title = tr(lang, 'Trening', 'Workout');
  if (!title) title = tr(lang, 'Wydarzenie', 'Event');
  const drafts = days.slice(0, count).map(date => {
    const slot = slots.find(s => s.date === date)!;
    return { title, startDate: date, endDate: date, startTime: timeString(slot.start), endTime: timeString(slot.start + duration), allDay: false, recurrence: 'NONE' as const };
  });
  return { text: tr(lang, `Przygotowałem ${count} propozycje po ${duration} min. Sprawdź wszystkie terminy przed zatwierdzeniem.`, `I prepared ${count} drafts of ${duration} minutes each. Review all dates before confirming.`), suggestedPlan: { kind: 'create', events: drafts, originals: [] } };
}
export function moveDraft(original: CalendarEvent, date: string, time?: string): AssistantPlan {
  const span = Math.round((Date.parse(original.endDate) - Date.parse(original.startDate)) / 86400000);
  const duration = original.allDay ? 0 : span * 1440 + minutes(original.endTime!) - minutes(original.startTime!);
  const start = time ? minutes(time) : original.allDay ? 0 : minutes(original.startTime!);
  return { kind: 'move', originals: [original], events: [{ ...original, startDate: date, endDate: addDays(date, original.allDay ? span : Math.floor((start + duration) / 1440)), startTime: original.allDay ? undefined : timeString(start), endTime: original.allDay ? undefined : timeString((start + duration) % 1440) }] };
}
