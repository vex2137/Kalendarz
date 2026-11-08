import { GOOGLE_CALENDAR_COLORS } from './constants';
import { requestedReminderMinutes } from './calendarReminder';
import type { AppLanguage } from './i18n';
import { addDays, isValidDate, localDate, timeString } from './dates';
import { parseModelCommand, type ModelCommand } from './modelCommand';
import { isReminderEventRequest } from './calendarReminder';

// Normalize matching only. Names and optional text always come from the original input.
export const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
const quoted = /"[^"]*"|„[^”]*”|“[^”]*”|«[^»]*»/gu;
const unquote = (value: string) => clean(value).replace(/^["„“«]|["”»]$/gu, '');
const clean = (value: string) => value.replace(/^[\s,;:?!]+|[\s,;:.?!]+$/g, '').replace(/\s+/g, ' ').trim();
const words: Record<string, number> = { jeden: 1, jedna: 1, one: 1, dwa: 2, dwie: 2, two: 2, trzy: 3, three: 3, cztery: 4, four: 4, piec: 5, five: 5 };
const count = (value: string) => words[value] ?? Number(value.replace(',', '.'));
const days = ['niedziel\\p{L}*|sunday', 'poniedzial\\p{L}*|monday', 'wtor\\p{L}*|tuesday', 'srod\\p{L}*|wednesday', 'czwart\\p{L}*|thursday', 'piat\\p{L}*|friday', 'sobot\\p{L}*|saturday'];
const months = ['stycz\\p{L}*|january', 'lut\\p{L}*|february', 'marc\\p{L}*|march', 'kwiet\\p{L}*|april', 'maj\\p{L}*|may', 'czerw\\p{L}*|june', 'lip\\p{L}*|july', 'sierp\\p{L}*|august', 'wrzes\\p{L}*|september', 'pazdzier\\p{L}*|october', 'listop\\p{L}*|november', 'grud\\p{L}*|december'];
const ordinalDays:Record<string,number>={};
const plDays=['pierwszego','drugiego','trzeciego','czwartego','piatego','szostego','siodmego','osmego','dziewiatego','dziesiatego','jedenastego','dwunastego','trzynastego','czternastego','pietnastego','szesnastego','siedemnastego','osiemnastego','dziewietnastego','dwudziestego'];
const enDays=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth'];
for(let i=0;i<20;i++){ordinalDays[plDays[i]]=i+1;ordinalDays[enDays[i]]=i+1;}
for(let i=0;i<9;i++){ordinalDays['dwudziestego '+plDays[i]]=21+i;ordinalDays['twenty-'+enDays[i]]=21+i;}
ordinalDays.trzydziestego=30;ordinalDays.thirtieth=30;ordinalDays['trzydziestego pierwszego']=31;ordinalDays['thirty-first']=31;
const dayAtom='(?:\\d{1,2}|'+Object.keys(ordinalDays).sort((a,b)=>b.length-a.length).map(s=>s.replace(/ /g,'\\s+').replace(/-/g,'[- ]')).join('|')+')';
const monthPattern = months.join('|');
const datePattern = new RegExp(`(?<![\\p{L}\\d])(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{1,2}(?:\\.\\d{4})?|${dayAtom}\\s+(?:${monthPattern})(?:\\s+\\d{4})?|(?:${monthPattern})\\s+${dayAtom}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|(?:za|in)\\s+(?:\\d+|jeden|one|dwa|dwie|two|trzy|three|cztery|four|piec|five)\\s+(?:dni|dzien|days?|tygodnie|tygodni|tydzien|weeks?)|the day after tomorrow|day after tomorrow|pojutrze|jutro|tomorrow|dzisiaj|dzis|today|(?:(?:w|we|on)\\s+)?(?:(?:te[nęa]?|ta|ten|this|przyszl\\p{L}*|nastepn\\p{L}*|next)\\s+)?(?:${days.join('|')}))(?![\\p{L}\\d])`, 'giu');

export function requestedEventColor(input:string){
 const name=input.match(/\b(?:kolor|color|colour)\s*:?\s*([\p{L}-]+)/iu)?.[1];
 if(!name)return;
 return Object.values(GOOGLE_CALENDAR_COLORS).find(c=>fold(c.id)===fold(name)||fold(c.name)===fold(name))?.id;
}

export function calendarDateMentions(input:string,now:Date):string[]{
 return [...fold(input).replace(quoted,m=>' '.repeat(m.length)).matchAll(datePattern)].filter(m=>!/^\d{1,2}\.\d{1,2}$/.test(m[0])||!/\b(?:o|at|od|from|do|to|until)\s*$/iu.test(input.slice(0,m.index))).map(m=>calendarDate(m[0],now)).filter((s):s is string=>Boolean(s));
}

export function calendarDate(text: string, now: Date): string | undefined {
  const value = fold(text).replace(/^(?:w|we|on)\s+/, '').replace(/^(?:te[nęa]?|ta|ten|this)\s+/, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isValidDate(value) ? value : undefined;
  const dot = value.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  const named = value.match(new RegExp(`^(?:(${dayAtom})\\s+(${monthPattern})|(${monthPattern})\\s+(${dayAtom})(?:st|nd|rd|th)?)(?:,?\\s+(\\d{4}))?$`, 'iu'));
  if (dot || named) {
    const dayText=dot?.[1]||named?.[1]||named?.[4]||'';
    const day = ordinalDays[dayText.replace(/\s+/g,' ').replace(/(?<=twenty|thirty) /g,'-')]||Number(dayText);
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

export interface UnresolvedTime { text: string; start: string; end?: string }
export interface CalendarFields { date?: string; time?: string; endTime?: string; endDate?: string; explicitEnd?: boolean; unresolvedTime?: UnresolvedTime; allDay?: boolean; duration?: number; rest: string; fragments: string[]; invalid: boolean }
export function calendarFields(input: string, now: Date): CalendarFields {
  input = clean(input.normalize('NFC'));
  let masked = fold(input).replace(quoted, m => ' '.repeat(m.length));
  const consumed = new Set<number>();
  const erase = (start: number, size: number) => { for (let i = start; i < start + size; i++) consumed.add(i); masked = masked.slice(0, start) + ' '.repeat(size) + masked.slice(start + size); };
  const result: CalendarFields = { rest: input, fragments: [], invalid: false };
  // A Polish dotted clock after an explicit time marker is not a DD.MM date.
  const dates = [...masked.matchAll(datePattern)].filter(m => !/^\d{1,2}\.\d{1,2}$/.test(m[0]) || !/\b(?:o(?:\s+godzinie)?|at|od|from|do|to|until)\s*$/iu.test(masked.slice(0, m.index)));
  if (dates.length > 1) result.invalid = true;
  if (dates[0]) { result.date = calendarDate(dates[0][0], now); result.invalid ||= !result.date; for(const date of dates)erase(date.index!,date[0].length); }
  const relative = masked.match(/\b(?:za|in)\s+(\d+|jedna|jeden|one|dwie|dwa|two)\s+(godzine|godziny|godzin|hours?|minut\p{L}*|minutes?)\b/iu);
  if (relative) {
    if (result.date) result.invalid = true;
    const delta = count(relative[1]) * (/^min/.test(relative[2]) ? 1 : 60);
    const total = now.getHours() * 60 + now.getMinutes() + delta;
    result.date = addDays(localDate(now), Math.floor(total / 1440)); result.time = timeString(total);
    erase(relative.index!, relative[0].length);
  }
  const duration = masked.match(/\b(?:na|przez|for|czas\s+trwania\s*:?)\s+(poltorej godziny|pol godziny|half an hour|one and a half hours|(?:\d+(?:[.,]\d+)?|jedna|jeden|dwie|dwa|two|one|an)\s*(?:godzin\p{L}*|hours?|h|minut\p{L}*|minutes?|mins?)|godzine|an hour)\b/iu);
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
  let end: number | undefined;
  const ranges = [...masked.matchAll(/(?<![\p{L}\d:.–—-])(?:(?:o(?:\s+godzinie)?|at|od|from)\s+)?(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*[-–—]\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)(?![\p{L}\d:.–—-])(?:\s+(?:time|godziny|godzinach))?/giu)];
  for (const range of ranges) {
    const trailing = masked.slice(range.index! + range[0].length).match(/^\s*([a-z]{2})(?!\p{L})/iu);
    const uncertain = trailing && !/^(?:am|pm|do|to|od|at|on|in|na|we)$/iu.test(trailing[1]);
    if (uncertain) result.unresolvedTime = {text:input.slice(range.index!, range.index!+range[0].length+trailing[0].length),start:range[1].trim(),end:range[2].trim()};
    const suffix = range[2].match(/(?:am|pm)$/iu)?.[0];
    const first = clock(range[1].trim() + (suffix && !/am|pm/iu.test(range[1]) ? suffix : ''));
    end = clock(range[2].trim()); result.explicitEnd = true;
    result.invalid ||= first === undefined || end === undefined || Boolean(result.time) || ranges.length > 1;
    if (first !== undefined) result.time = timeString(first);
    erase(range.index!, range[0].length + (uncertain ? trailing[0].length : 0));
  }
  const clocks = [...masked.matchAll(/\b(o(?:\s+godzinie)?|at|od(?:\s+godzin[yie]+)?|from|do(?:\s+godzin[yie]+)?|until|to)\s+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)(?![\p{L}\d:.])/giu)];
  for (const m of clocks) {
    const trailing = masked.slice(m.index! + m[0].length).match(/^\s*([a-z]{2})(?!\p{L})/iu);
    const uncertain = trailing && !/^(?:am|pm|do|to|od|at|on|in|na|we)$/iu.test(trailing[1]);
    if (uncertain) result.unresolvedTime = {text:input.slice(m.index!,m.index!+m[0].length+trailing[0].length),start:m[2].trim()};
    const value = clock(m[2]);
    result.invalid ||= value === undefined;
    if (/^(?:do(?:\s|$)|until$|to$)/.test(m[1])) { if (end !== undefined) result.invalid = true; end = value; result.explicitEnd = true; }
    else { if (result.time) result.invalid = true; if (value !== undefined) result.time = timeString(value); }
    erase(m.index!, m[0].length + (uncertain ? trailing[0].length : 0));
  }
  result.invalid ||= Boolean(result.allDay && (result.time || result.duration || end !== undefined));
  if (end !== undefined && result.duration !== undefined) result.invalid = true;
  if (result.time) {
    const start = clock(result.time)!;
    if (end === start) result.invalid = true;
    const finish = end !== undefined ? end + (end < start ? 1440 : 0) : start + (result.duration ?? 60);
    result.endTime = timeString(finish);
    if (result.date) result.endDate = addDays(result.date, Math.floor(finish / 1440));
  } else if (end !== undefined) result.invalid = true;
  result.rest = clean(input.split('').map((ch, i) => consumed.has(i) ? ' ' : ch).join(''));
  // Joiners around consumed fields have no title meaning. Never remove inside a quoted name.
  result.rest = result.rest.replace(/^(?:na|w|we|on|for)\s+/iu, '').replace(/\s+(?:na|w|we|on|for)$/iu, '').trim();
  if (/^(?:na|w|we|on|for)$/iu.test(result.rest)) result.rest='';
  result.fragments = input.split('').map((ch, i) => consumed.has(i) ? '\0' : ch).join('').split(/\0+/).map(part => clean(part).replace(/^(?:na|w|we|on|for)\s+|\s+(?:na|w|we|on|for)$/giu, '').trim()).filter(part => part && !/^(?:na|w|we|on|for)$/iu.test(part));
  return result;
}

export interface PendingCalendarCommand { command: ModelCommand; request: string; unresolvedTime?: UnresolvedTime }
export interface ParsedCalendarCommand extends PendingCalendarCommand { incomplete?: boolean }
export interface CalendarValidationTrace {
 stage:string; code?:string; field?:string; expectedType?:string; receivedType?:string; operationCount:number;
}
export function parseCalendarCommand(input: string, language: AppLanguage, now: Date, pending?: PendingCalendarCommand): ParsedCalendarCommand | undefined {
  if (language !== 'pl' && language !== 'en') return;
  const editSentence=input.match(/^(?:edytuj|edit) (?:wydarzenie |event )?(.+?) (?:z dnia|from|on) (.+?)\. *(?:zmie[ńn] godzin[ęe] rozpocz[ęe]cia na|change (?:the )?start time to) (\d{1,2}:\d{2}),?\s*(?:a zako[ńn]czenia na|and (?:the )?end time to)\s*(\d{1,2}:\d{2})[.!]?$/iu);
  if(editSentence){
    const source=calendarDate(fold(editSentence[2]),now);if(!source)return;
    return parseCalendarCommand(`Move event ${JSON.stringify(unquote(editSentence[1]))} from ${source} to ${editSentence[3]}–${editSentence[4]}`,language,now);
  }
  const limited=input.match(/^(?:Nie zmieniaj tytu[łl]u|Keep the title)\s+(.+?),?\s+(?:tylko godzin[ęe] na|only change its time to)\s+(\d{1,2}[:.]\d{2})[.!]?$/iu);
  if(limited)return parseCalendarCommand('Move '+limited[1].replace(/,$/u,'')+' at '+limited[2],language,now);
  input=input.replace(/,?\s+(?:ale zachowaj czas trwania|but keep its duration)[.!]?$/iu,'');
  input = input.normalize('NFC').replace(/^dodja\b/iu,'Dodaj').replace(/^ad\s+(?=a |an |event )/iu,'Add ').replace(/^przes[oó]n\b/iu,'Przesuń').replace(/^reshedule\b/iu,'Reschedule').replace(/^skas[oó]j\b/iu,'Skasuj').replace(/^deleet\b/iu,'Delete');
  if (pending?.unresolvedTime && /^(?:am|pm)\s*[.!?]?$/iu.test(input.trim())) {
    const marker = input.trim().slice(0,2);
    return parseCalendarCommand(`at ${pending.unresolvedTime.start}${pending.unresolvedTime.end ? '-'+pending.unresolvedTime.end : ''} ${marker}`,language,now,{...pending,unresolvedTime:undefined});
  }
  if (pending) input = input.replace(/^(?:actually|i meant|i mean|jednak|chodzi mi o|chodziło mi o)\s+/iu,'');
  const completeRequest=input,reminder=requestedReminderMinutes(input);
  if(reminder!==undefined)input=input.replace(/[,;]?\s+(?:z przypomnieniem|with (?:a )?reminder)\s+(?:\d+\s+\p{L}+\s+(?:przed|wcześniej|before|earlier)).*$/iu,'');
  const text = clean(input), normalized = fold(text);
  // Unsupported scope, constraints and corrections go to the real extractor. Avoid partial parsing.
  const outsideQuotes = normalized.replace(quoted, '').replace(/[,;]\s*(?:opis|description|miejsce|location):[\s\S]*$/iu, '').replace(/\b(?:the )?day after tomorrow\b/giu, ' ').replace(/^(?:przypomnij\s+mi\s+o|remind\s+me\s+(?:about|to))\s+/iu,'');
  if (/\b(?:nie|not|never|don't|zamiast|instead|jednak|actually|except|oprocz|before|after|przed|po|kazd\p{L}*|co tydzien|codzien\p{L}*|every|daily|weekly|remind\p{L}*|przypomn\p{L}*)\b/iu.test(outsideQuotes)) return;
  let body = text.replace(/^(?:prosz[eę][,\s]+|please\s+|(?:czy\s+)?mo[zż]esz\s+|(?:czy\s+)?m[oó]g[łl]by[sś]\s+|could you\s+)/iu, '');
  body = body.replace(/^(?:(?:o|oh|ok|okay|tak|yes|jak|how|super|great|dobrze|świetnie|swietnie|thanks|dzięki|dzieki)[,!\s]+)+(?=(?:dodaj|utw[oó]rz|add|create|wpisz|zapisz)\s)/iu, '');
  const n = fold(body);
  const make = (command: Partial<ModelCommand>, request = completeRequest): ParsedCalendarCommand => ({ command: parseModelCommand(JSON.stringify(command)), request });
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
  const prefix = n.match(/^(dodaj|dodac|utworz(?:yc)?(?: wydarzenie)?|wpisz(?: do kalendarza)?|wpisac(?: do kalendarza)?|wrzuc(?:ic)?|zapisz|zapisac|dopisz|dopisac|wstaw(?:ic)?|add|create(?: event)?|zaplanuj|przypomnij mi o|remind me about|remind me to|schedule|put|przenies(?:c)?|przesun(?:ac)?|przeloz|zmien(?:ic)? godzine|move|reschedule|change (?:the )?time(?: of)?|usun(?:ac)?|skasuj|skasowac|wykresl(?:ic)?|odwolaj|odwolac|delete|remove|cancel|znajdz|znalezc|wyszukaj|wyszukac|szukaj|pokaz(?:ac)? wydarzenia|find|search(?: for)?|show events for)\s+/iu);
  if (!prefix) {
    if (!pending) return;
    const fields = calendarFields(body, now);
    if (fields.invalid || fields.rest || (!fields.date && !fields.time && !fields.allDay)) return;
    const merged = { ...pending.command, ...Object.fromEntries(Object.entries(fields).filter(([k, v]) => ['date', 'time', 'endTime', 'endDate', 'allDay'].includes(k) && v !== undefined)) };
    // Revalidate the merged, explicitly provided fields. Appending old and new
    // date/time phrases made a corrected draft look contradictory.
    const pendingDuration = fields.duration ?? calendarFields(pending.request,now).duration;
    const request = `Add event "${merged.title || ''}" ${merged.date || ''}${merged.allDay ? ' all day' : merged.time ? ` at ${merged.time}${fields.explicitEnd && merged.endTime ? ' to '+merged.endTime : ''}` : ''}${pendingDuration ? ' for '+pendingDuration+' minutes' : ''}${merged.location ? '; location: "'+merged.location+'"' : ''}${merged.description ? '; description: "'+merged.description+'"' : ''}`;
    return { ...make(merged, request), incomplete: !merged.title || !merged.date || (!merged.time && !merged.allDay) };
  }
  const action = /^(przenies|przesun|przeloz|zmien|move|reschedule|change)/.test(prefix[1]) ? 'update' : /^(usun|skas|wykres|odwol|delete|remove|cancel)/.test(prefix[1]) ? 'delete' : /^(znajdz|znalezc|wyszuk|szuk|pokaz|find|search|show)/.test(prefix[1]) ? 'search' : 'create';
  body = body.slice(prefix[0].length).replace(/^(?:mi\s+|(?:(?:(?:a|an)\s+)?(?:new\s+)?event|(?:nowe\s+)?(?:wyda(?:rz|ż)enie|wydarzenia))\s+)/iu, '').replace(/\s+(?:in my calendar|to my calendar)$/iu, '');
  body = body.replace(/^(?:called|named|o nazwie|pod tytu[łl]em)\s+/iu,'');
  body = body.replace(/\bdnia\s+(?=\d)/giu,'');
  let explicitTitle: string | undefined;
  if (action === 'create') body = body.replace(/\s+(?:called|named|o nazwie|pod tytu[łl]em)\s+(.+)$/iu, (_, title: string) => { explicitTitle=unquote(title); return ''; });
  // English calendar placement may occur before the date.
  body = body.replace(/\s+(?:in my calendar|to my calendar)(?=\s)/iu, '');
  const color=requestedEventColor(body);
  body=body.replace(/[,;]\s*(?:kolor|color|colour):?\s*([\p{L}-]+)/giu,(full)=>color?'':full);
  let location: string | undefined, description: string | undefined;
  body = body.replace(/[,;]\s*(miejsce|location|opis|description):\s*([^,;]+)(?=[,;]|$)/giu, (_, key: string, value: string) => { if (/miejsce|location/i.test(key)) location = value.trim(); else description = value.trim(); return ''; });
  // An unlabelled place is accepted only after an explicit clock, preserving its exact spelling.
  body = body.replace(/(?<=(?:\d|am|pm))\s+(?:w|we|in|at)\s+([^\d,;]+)$/iu, (_, place: string) => { location = place.trim(); return ''; });
  let sourceDate: string | undefined;
  if (action === 'update') {
    const split=fold(body).match(/\s+(?:na|to)\s+/iu);
    if(split){
      const before=calendarFields(body.slice(0,split.index),now);
      const tail=body.slice(split.index!+split[0].length).replace(/^(?:godzin[ęea]|the time)\s+(?=\d)/iu,'').replace(/\s+(?:tego samego dnia|on the same day)[.!]?$/iu,'').trim();
      if(before.invalid)return;
      sourceDate=before.date;
      body=before.rest.replace(/\s+(?:z|from|on|w|dnia)$/iu,'')+' '+(/^\d{1,2}(?:[:.]\d{2})?(?:\s*(?:am|pm))?(?:$|[–—-]|\s+(?:do|to|until)\s)/iu.test(tail)?'at ':'')+tail;
    }
    const source = fold(body).match(/\s+(?:z|from)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+(?:na|to)\s+/iu);
    if (source) { sourceDate = calendarDate(source[1], now); if (!sourceDate) return; body = body.slice(0, source.index) + ' ' + body.slice(source.index! + source[0].length); }
    if (/^(zmien(?:ic)? godzine|change the time of)/.test(prefix[1])) body = body.replace(/\s+(?:na|to)\s+(?=\d)/iu, ' at ');
  }
  const fields = calendarFields(body, now);
  if (fields.invalid) return;
  if(action==='update'&&!sourceDate&&fields.date&&(fields.time||fields.explicitEnd)&&!/\s+(?:na|to)\s+/iu.test(input)) {sourceDate=fields.date;fields.date=undefined;}
  if (action === 'create' && fields.fragments.length > 1) {
    const names=[...fields.rest.matchAll(quoted)];
    if(names.length!==1||clean(fields.rest.replace(quoted,'').replace(/\b(?:na|w|we|on|for)\b/giu,'')))return;
    fields.rest=names[0][0];
  }
  let name = fields.rest.replace(/^(?:wydarzeni\p{L}*|event|mi)\s+/iu, '').replace(/\s+(?:z|na|to|on|from|w|we|dnia)$/iu, '').trim();
  if (explicitTitle) { if (name) return; name=explicitTitle; }
  // A complete, single-event phrase uses the same parser as add/create.
  // Counts, incomplete scheduling and broader plans still reach model extraction.
  if (/^(?:zaplanuj|schedule)$/.test(prefix[1]) || isReminderEventRequest(text)) {
    if (!name || !fields.date || (!fields.time && !fields.allDay) || /^(?:\d+|jeden|jedna|dwa|dwie|trzy|cztery|piec|one|two|three|four|five|multiple|kilka)\s/iu.test(fold(name))) return;
  }
  if (action !== 'create') name = name.replace(/^(?:for|u)\s+/iu, '');
  if (!name && action !== 'create' && action !== 'search') return;
  // Leave unsupported trailing clauses to LFM rather than silently interpreting them as names.
  if (/\b(?:ale|but|oraz|and then|z opisem|with description|od|from|until)\b/iu.test(fold(name).replace(quoted, ''))) return;
  const command = make({ action, ...(action === 'create' ? { title: unquote(name) || null } : { query: unquote(name) || null }), date: fields.date, time: fields.unresolvedTime ? null : fields.time, allDay: fields.allDay, ...(action === 'create' || fields.duration !== undefined || fields.explicitEnd ? { endTime: fields.unresolvedTime ? null : fields.endTime, endDate: fields.unresolvedTime ? null : fields.endDate } : {}), ...(color?{color}:{}),...(reminder!==undefined?{reminderMinutes:reminder}:{}),sourceDate: sourceDate || (action === 'delete' ? fields.date : undefined), location, description });
  if (fields.unresolvedTime) command.unresolvedTime = fields.unresolvedTime;
  command.incomplete = action === 'create' && (Boolean(fields.unresolvedTime) || !command.command.title || !fields.date || (!fields.time && !fields.allDay));
  return command;
}

// An explicit batch is validated as a whole; an incomplete member never becomes
// a partially executable proposal. Optional semicolon fields are not batches.
export function parseCalendarBatch(input:string,language:AppLanguage,now:Date,diagnostic?:CalendarValidationTrace):ParsedCalendarCommand[]|undefined {
 if(language!=='pl'&&language!=='en')return;
 const verb=/^(?:dodaj|utworz|zaplanuj|add|create|schedule)\b/iu;
 const text=fold(input.trim());if(!verb.test(text))return;
 const header=text.match(/^(?:dodaj|utworz|zaplanuj|add|create|schedule)\s+(?:(\d+|dwa|dwie|trzy|cztery|piec|two|three|four|five|kilka|multiple)\s+)?(?:wydarzenia|wydarzen|events)\s*:\s*/u);
 const counts:Record<string,number>={dwa:2,dwie:2,trzy:3,cztery:4,piec:5,two:2,three:3,four:4,five:5};
 const expected=header?.[1]?(counts[header[1]]||Number(header[1])||undefined):undefined;
 const body=input.trim().slice(header?.[0].length||0),mask=fold(body).replace(quoted,m=>' '.repeat(m.length));
 const repeated=[...mask.matchAll(/\b(?:dodaj|utworz|zaplanuj|add|create|schedule)\s+(?:wydarzenie|event)\b/giu)].length>1;
 const separators=[...mask.matchAll(/[,;\n]+|\b(?:oraz|and|i)\b|\.(?=\s*(?:dodaj|utworz|zaplanuj|add|create|schedule)\s)/giu)];
 if(!header&&!repeated){
   // Preserve the existing repeated-verb semicolon syntax.
   if(!/[;\n]/.test(mask)||[...mask.matchAll(/(?:^|[;\n])\s*(?:dodaj|utworz|zaplanuj|add|create|schedule)\b/giu)].length<2)return;
 }
 if(diagnostic){diagnostic.stage='batch-segmentation';diagnostic.operationCount=0;}
 const invalid=()=>{if(diagnostic){diagnostic.code='batch-incomplete-or-ambiguous';diagnostic.field='operations';diagnostic.expectedType='complete-event-list';diagnostic.receivedType='text';}return [];};
 if(separators.length>64||expected!==undefined&&(expected<2||expected>20))return invalid();
 const positions=[{end:0,next:0},...separators.map(m=>({end:m.index!,next:m.index!+m[0].length})),{end:body.length,next:body.length}];
 const memo=new Map<number,ParsedCalendarCommand[][]>();
 function solve(at:number):ParsedCalendarCommand[][] {
  if(at===positions.length-1)return [[]];
  if(memo.has(at))return memo.get(at)!;
  const solutions:ParsedCalendarCommand[][]=[];
  for(let stop=at+1;stop<positions.length;stop++){
   const part=body.slice(positions[at].next,positions[stop].end).trim().replace(at>0?/^(?:oraz|and|i)\s+/iu:/$^/u,'');
   if(/^(?:delete|remove|move|reschedule|rename|usun|przesun|przenies|zmien|skasuj)\b/iu.test(fold(part)))continue;
   if(!part||/^(?:opis|description|miejsce|location|kolor|colou?r)\s*:/iu.test(part)||!header&&!verb.test(fold(part)))continue;
   // Every candidate retains its verbatim title/date/clock clause. Only a
   // missing repeated imperative is supplied, not any calendar field.
   const parsed=parseCalendarCommand(verb.test(fold(part))?part:'Add event '+part,language,now);
   if(!parsed||parsed.command.action!=='create'||parsed.incomplete)continue;
   for(const tail of solve(stop)){
    if(tail.length>=20)continue;
    const list=[parsed,...tail],identity=JSON.stringify(list.map(p=>p.command));
    if(solutions.some(s=>JSON.stringify(s.map(p=>p.command))===identity))continue;
    solutions.push(list);if(solutions.length===2)break;
   }
   if(solutions.length===2)break;
  }
  memo.set(at,solutions);return solutions;
 }
 const extracted=solve(0);if(diagnostic)diagnostic.operationCount=extracted.length===1?extracted[0].length:0;
 const solutions=extracted.filter(list=>list.length>=2&&(!expected||list.length===expected));
 if(solutions.length!==1)return invalid();
 const result=solutions[0];if(diagnostic){diagnostic.operationCount=result.length;diagnostic.stage='batch-extracted';}return result;
}
