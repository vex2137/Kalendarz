import type { AppLanguage } from './i18n';
import { addDays, isValidDate, localDate, timeString } from './dates';
import { parseModelCommand, type ModelCommand } from './modelCommand';

// Normalize matching only. Names and optional text always come from the original input.
export const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
const quoted = /"[^"]*"|„[^”]*”|“[^”]*”|«[^»]*»/gu;
const unquote = (value: string) => value.trim().replace(/^["„“«]|["”»]$/gu, '');
const clean = (value: string) => value.replace(/^[\s,;:?!]+|[\s,;:.?!]+$/g, '').replace(/\s+/g, ' ').trim();
const words: Record<string, number> = { jeden: 1, jedna: 1, one: 1, dwa: 2, dwie: 2, two: 2, trzy: 3, three: 3, cztery: 4, four: 4, piec: 5, five: 5 };
const count = (value: string) => words[value] ?? Number(value.replace(',', '.'));
const days = ['niedziel\\p{L}*|sunday', 'poniedzial\\p{L}*|monday', 'wtor\\p{L}*|tuesday', 'srod\\p{L}*|wednesday', 'czwart\\p{L}*|thursday', 'piat\\p{L}*|friday', 'sobot\\p{L}*|saturday'];
const months = ['stycz\\p{L}*|january', 'lut\\p{L}*|february', 'marc\\p{L}*|march', 'kwiet\\p{L}*|april', 'maj\\p{L}*|may', 'czerw\\p{L}*|june', 'lip\\p{L}*|july', 'sierp\\p{L}*|august', 'wrzes\\p{L}*|september', 'pazdzier\\p{L}*|october', 'listop\\p{L}*|november', 'grud\\p{L}*|december'];
const monthPattern = months.join('|');
const datePattern = new RegExp(`(?<![\\p{L}\\d])(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{1,2}(?:\\.\\d{4})?|\\d{1,2}\\s+(?:${monthPattern})(?:\\s+\\d{4})?|(?:${monthPattern})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|(?:za|in)\\s+(?:\\d+|jeden|one|dwa|dwie|two|trzy|three|cztery|four|piec|five)\\s+(?:dni|dzien|days?|tygodnie|tygodni|tydzien|weeks?)|the day after tomorrow|day after tomorrow|pojutrze|jutro|tomorrow|dzisiaj|dzis|today|(?:(?:w|we|on)\\s+)?(?:(?:te[nęa]?|ta|ten|this|przyszl\\p{L}*|nastepn\\p{L}*|next)\\s+)?(?:${days.join('|')}))(?![\\p{L}\\d])`, 'giu');

export function calendarDate(text: string, now: Date): string | undefined {
  const value = fold(text).replace(/^(?:w|we|on)\s+/, '').replace(/^(?:te[nęa]?|ta|ten|this)\s+/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isValidDate(value) ? value : undefined;
  const dot = value.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  const named = value.match(new RegExp(`^(?:(\\d{1,2})\\s+(${monthPattern})|(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?:,?\\s+(\\d{4}))?$`, 'iu'));
  if (dot || named) {
    const day = Number(dot?.[1] || named?.[1] || named?.[4]);
    const month = dot ? Number(dot[2]) : months.findIndex(p => new RegExp(`^(?:${p})$`, 'iu').test(named![2] || named![3])) + 1;
    const year = Number(dot?.[3] || named?.[5] || now.getFullYear());
    const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return isValidDate(result) ? result : undefined;
  }
  const today = localDate(now);
  if (/^(?:pojutrze|(?:the )?day after tomorrow)$/.test(value)) return addDays(today, 2);
  if (/^(?:jutro|tomorrow)$/.test(value)) return addDays(today, 1);
  if (/^(?:dzisiaj|dzis|today)$/.test(value)) return today;
  const relative = value.match(/^(?:za|in)\s+(\S+)\s+(\S+)$/);
  if (relative) { const n = count(relative[1]); return n > 0 && n <= 366 ? addDays(today, n * (/ty|week/.test(relative[2]) ? 7 : 1)) : undefined; }
  const weekday = days.findIndex(p => new RegExp(`(?:^|\\s)(?:${p})$`, 'iu').test(value));
  if (weekday < 0) return undefined;
  const offset = /przyszl|nastepn|next/.test(value) ? 7 - (now.getDay() + 6) % 7 + (weekday + 6) % 7 : (weekday - now.getDay() + 7) % 7;
  return addDays(today, offset);
}

function clock(value: string): number | undefined {
  const m = fold(value).match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (min > 59 || h > (m[3] ? 12 : 23) || (m[3] && h < 1)) return;
  if (m[3]) h = h % 12 + (m[3] === 'pm' ? 12 : 0);
  return h * 60 + min;
}

export interface CalendarFields { date?: string; time?: string; endTime?: string; endDate?: string; allDay?: boolean; duration?: number; rest: string; fragments: string[]; invalid: boolean }
export function calendarFields(input: string, now: Date): CalendarFields {
  input = clean(input.normalize('NFC'));
  let masked = fold(input).replace(quoted, m => ' '.repeat(m.length));
  const consumed = new Set<number>();
  const erase = (start: number, size: number) => { for (let i = start; i < start + size; i++) consumed.add(i); masked = masked.slice(0, start) + ' '.repeat(size) + masked.slice(start + size); };
  const result: CalendarFields = { rest: input, fragments: [], invalid: false };
  // A Polish dotted clock after an explicit time marker is not a DD.MM date.
  const dates = [...masked.matchAll(datePattern)].filter(m => !/^\d{1,2}\.\d{1,2}$/.test(m[0]) || !/\b(?:o|at|od|from|do|to|until)\s*$/iu.test(masked.slice(0, m.index)));
  if (dates.length > 1) result.invalid = true;
  if (dates[0]) { result.date = calendarDate(dates[0][0], now); result.invalid ||= !result.date; erase(dates[0].index!, dates[0][0].length); }
  const relative = masked.match(/\b(?:za|in)\s+(\d+|jedna|jeden|one|dwie|dwa|two)\s+(godzine|godziny|godzin|hours?|minut\p{L}*|minutes?)\b/iu);
  if (relative) {
    if (result.date) result.invalid = true;
    const delta = count(relative[1]) * (/^min/.test(relative[2]) ? 1 : 60);
    const total = now.getHours() * 60 + now.getMinutes() + delta;
    result.date = addDays(localDate(now), Math.floor(total / 1440)); result.time = timeString(total);
    erase(relative.index!, relative[0].length);
  }
  const duration = masked.match(/\b(?:na|przez|for)\s+(poltorej godziny|pol godziny|half an hour|one and a half hours|(?:\d+(?:[.,]\d+)?|jedna|jeden|dwie|dwa|two|one|an)\s*(?:godzin\p{L}*|hours?|h|minut\p{L}*|minutes?|mins?)|godzine|an hour)\b/iu);
  if (duration) {
    const value = duration[1];
    result.duration = /poltorej|one and a half/.test(value) ? 90 : /pol |half/.test(value) ? 30 : /^(godzine|an hour)$/.test(value) ? 60 : (() => { const m = value.match(/^(\d+(?:[.,]\d+)?|jedna|jeden|dwie|dwa|two|one|an)\s*(\p{L}+)$/u)!; return (m[1] === 'an' ? 1 : count(m[1])) * (/^min/.test(m[2]) ? 1 : 60); })();
    result.invalid ||= !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 1440;
    erase(duration.index!, duration[0].length);
  }
  const allDay = masked.match(/\b(?:caly dzien|calodniow\p{L}*|all[ -]day)\b/iu);
  if (allDay) { result.allDay = true; erase(allDay.index!, allDay[0].length); }
  const noon = masked.match(/\b(?:w poludnie|o polnocy|at noon|at midnight)\b/iu);
  if (noon) { result.time = /poludnie|noon/.test(noon[0]) ? '12:00' : '00:00'; erase(noon.index!, noon[0].length); }
  const clocks = [...masked.matchAll(/\b(o|at|od|from|do|until|to)\s+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)(?![\p{L}\d:.])/giu)];
  let end: number | undefined;
  for (const m of clocks) {
    const value = clock(m[2]);
    result.invalid ||= value === undefined;
    if (/^(do|until|to)$/.test(m[1])) { if (end !== undefined) result.invalid = true; end = value; }
    else { if (result.time) result.invalid = true; if (value !== undefined) result.time = timeString(value); }
    erase(m.index!, m[0].length);
  }
  result.invalid ||= Boolean(result.allDay && (result.time || result.duration || end !== undefined));
  if (end !== undefined && result.duration !== undefined) result.invalid = true;
  if (result.time) {
    const start = clock(result.time)!;
    if (end !== undefined && end <= start) result.invalid = true; // Require an explicit next-day date for inverted ranges.
    const finish = end !== undefined ? end : start + (result.duration ?? 60);
    result.endTime = timeString(finish);
    if (result.date) result.endDate = addDays(result.date, Math.floor(finish / 1440));
  } else if (end !== undefined) result.invalid = true;
  result.rest = clean(input.split('').map((ch, i) => consumed.has(i) ? ' ' : ch).join(''));
  // Joiners around consumed fields have no title meaning. Never remove inside a quoted name.
  result.rest = result.rest.replace(/^(?:na|w|we|on|for)\s+/iu, '').replace(/\s+(?:na|w|we|on|for)$/iu, '').trim();
  result.fragments = input.split('').map((ch, i) => consumed.has(i) ? '\0' : ch).join('').split(/\0+/).map(part => clean(part).replace(/^(?:na|w|we|on|for)\s+|\s+(?:na|w|we|on|for)$/giu, '').trim()).filter(part => part && !/^(?:na|w|we|on|for)$/iu.test(part));
  return result;
}

export interface ParsedCalendarCommand { command: ModelCommand; request: string; incomplete?: boolean }
export function parseCalendarCommand(input: string, language: AppLanguage, now: Date, pending?: { command: ModelCommand; request: string }): ParsedCalendarCommand | undefined {
  if (language !== 'pl' && language !== 'en') return;
  input = input.normalize('NFC');
  const text = clean(input), normalized = fold(text);
  // Unsupported scope, constraints and corrections go to the real extractor. Avoid partial parsing.
  const outsideQuotes = normalized.replace(quoted, '').replace(/[,;]\s*(?:opis|description|miejsce|location):[\s\S]*$/iu, '').replace(/\b(?:the )?day after tomorrow\b/giu, ' ');
  if (/\b(?:nie|not|never|don't|zamiast|instead|jednak|actually|except|oprocz|before|after|przed|po|kazd\p{L}*|co tydzien|codzien\p{L}*|every|daily|weekly|remind\p{L}*|przypomn\p{L}*)\b/iu.test(outsideQuotes)) return;
  let body = text.replace(/^(?:prosz[eę][,\s]+|please\s+|(?:czy\s+)?mo[zż]esz\s+|(?:czy\s+)?m[oó]g[łl]by[sś]\s+|could you\s+)/iu, '');
  const n = fold(body);
  const make = (command: Partial<ModelCommand>, request = input): ParsedCalendarCommand => ({ command: parseModelCommand(JSON.stringify(command)), request });
  const tool = n.match(/^(co mam|pokaz (?:mi )?plan|jak wyglada|what is on|show my schedule|(?:kiedy mam|czy mam) woln\p{L}*|znajdz wolny czas|when am i free|am i free|find free time)\s*(.*)$/iu);
  if (tool) {
    const fields = calendarFields(body.slice(tool[1].length), now);
    if (fields.invalid || !fields.date || !/^(?:na|for)?$/iu.test(fields.rest)) return;
    const free = /woln|free/.test(tool[1]);
    const range = fields.time ? ` from ${fields.time} to ${fields.endTime}` : '';
    return make({ action: 'assistant', query: free ? `Free time on ${fields.date}${range}${fields.duration ? ` for ${fields.duration} minutes` : ''}` : `What is on ${fields.date}?` });
  }
  if (/^(sprawdz (?:konflikty|kolizje)|check conflicts)$/.test(n)) return make({ action: 'assistant', query: 'Check for conflicts' });
  const rename = n.match(/^(?:zmien(?:ic)? nazwe|rename)\s+(.+?)\s+(?:na|to)\s+(.+)$/iu);
  if (rename) {
    const offset = n.indexOf(rename[2], n.indexOf(rename[1]) + rename[1].length);
    return make({ action: 'update', query: unquote(body.slice(n.indexOf(rename[1]), n.indexOf(rename[1]) + rename[1].length)), title: unquote(body.slice(offset)) });
  }
  const prefix = n.match(/^(dodaj|dodac|utworz(?:yc)?(?: wydarzenie)?|wpisz(?: do kalendarza)?|wpisac(?: do kalendarza)?|wrzuc(?:ic)?|zapisz|zapisac|dopisz|dopisac|wstaw(?:ic)?|add|create(?: event)?|schedule|put|przenies(?:c)?|przesun(?:ac)?|zmien(?:ic)? godzine|move|reschedule|change the time of|usun(?:ac)?|skasuj|skasowac|wykresl(?:ic)?|odwolaj|odwolac|delete|remove|cancel|znajdz|znalezc|wyszukaj|wyszukac|szukaj|pokaz(?:ac)? wydarzenia|find|search(?: for)?|show events for)\s+/iu);
  if (!prefix) {
    if (!pending) return;
    const fields = calendarFields(body, now);
    if (fields.invalid || fields.rest || (!fields.date && !fields.time && !fields.allDay)) return;
    const merged = { ...pending.command, ...Object.fromEntries(Object.entries(fields).filter(([k, v]) => ['date', 'time', 'endTime', 'endDate', 'allDay'].includes(k) && v !== undefined)) };
    const request = `${pending.request} ${input}`;
    return { ...make(merged, request), incomplete: !merged.title || !merged.date || (!merged.time && !merged.allDay) };
  }
  const action = /^(przenies|przesun|zmien|move|reschedule|change)/.test(prefix[1]) ? 'update' : /^(usun|skas|wykres|odwol|delete|remove|cancel)/.test(prefix[1]) ? 'delete' : /^(znajdz|znalezc|wyszuk|szuk|pokaz|find|search|show)/.test(prefix[1]) ? 'search' : 'create';
  body = body.slice(prefix[0].length).replace(/^(?:mi\s+|(?:wydarzenie|wydarzenia|event)\s+)/iu, '').replace(/\s+(?:in my calendar|to my calendar)$/iu, '');
  // English calendar placement may occur before the date.
  body = body.replace(/\s+(?:in my calendar|to my calendar)(?=\s)/iu, '');
  let location: string | undefined, description: string | undefined;
  body = body.replace(/[,;]\s*(miejsce|location|opis|description):\s*([^,;]+)(?=[,;]|$)/giu, (_, key: string, value: string) => { if (/miejsce|location/i.test(key)) location = value.trim(); else description = value.trim(); return ''; });
  // An unlabelled place is accepted only after an explicit clock, preserving its exact spelling.
  body = body.replace(/(?<=(?:\d|am|pm))\s+(?:w|we|in|at)\s+([^\d,;]+)$/iu, (_, place: string) => { location = place.trim(); return ''; });
  let sourceDate: string | undefined;
  if (action === 'update') {
    const source = fold(body).match(/\s+(?:z|from)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+(?:na|to)\s+/iu);
    if (source) { sourceDate = calendarDate(source[1], now); if (!sourceDate) return; body = body.slice(0, source.index) + ' ' + body.slice(source.index! + source[0].length); }
    if (/^(zmien(?:ic)? godzine|change the time of)/.test(prefix[1])) body = body.replace(/\s+(?:na|to)\s+(?=\d)/iu, ' at ');
  }
  const fields = calendarFields(body, now);
  if (fields.invalid) return;
  if (action === 'create' && fields.fragments.length > 1) return;
  let name = fields.rest.replace(/^(?:wydarzeni\p{L}*|event|mi)\s+/iu, '').replace(/\s+(?:z|na|to|on)$/iu, '').trim();
  if (action !== 'create') name = name.replace(/^(?:for|u)\s+/iu, '');
  if (!name && action !== 'create' && action !== 'search') return;
  // Leave unsupported trailing clauses to LFM rather than silently interpreting them as names.
  if (/\b(?:ale|but|oraz|and then|z opisem|with description|od|from|until)\b/iu.test(fold(name).replace(quoted, ''))) return;
  const command = make({ action, ...(action === 'create' ? { title: unquote(name) || null } : { query: unquote(name) || null }), date: fields.date, time: fields.time, allDay: fields.allDay, ...(action === 'create' || fields.duration !== undefined || /\b(?:do|until|to)\s+\d/iu.test(body) ? { endTime: fields.endTime, endDate: fields.endDate } : {}), sourceDate: sourceDate || (action === 'delete' ? fields.date : undefined), location, description });
  command.incomplete = action === 'create' && (!command.command.title || !fields.date || (!fields.time && !fields.allDay));
  return command;
}
