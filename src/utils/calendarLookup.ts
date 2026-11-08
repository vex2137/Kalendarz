import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { tr } from './i18n';
import { addDays, localDate, minutes, timeString } from './dates';
import { availableSlots, searchCalendar, requestedDuration } from './assistantPlanning';
import { buildEventIndex } from './recurrence';
import { calendarFields, calendarDateMentions, fold } from './calendarCommandParser';
import type { AiResponseResult } from './aiEngine';

// Read-only calendar tools use the same real event objects as mutation matching.
// No model text, generated title or fictional benchmark calendar is a write result.
export function calendarLookup(request:string,events:CalendarEvent[],lang:AppLanguage,now:Date,prefs:PlanningPreferences):{result:AiResponseResult;selected:CalendarEvent[];action:'search'|'assistant'}|undefined {
 if(lang!=='pl'&&lang!=='en')return;
 const text=fold(request),outside=text.replace(/"[^"]*"|„[^”]*”|“[^”]*”|«[^»]*»/gu,'');
 if(/^(?:dodaj|utworz|create|add|schedule|zaplanuj|move|przenies|przesun|delete|remove|usun|skasuj|rename|zmien)\b/u.test(text))return;
 const free=/\b(?:free|availability|available|woln\p{L}*|okienk\p{L}*|gap|meeting-free)\b/u.test(outside);
 const read=/^(?:co mam|co mnie|co zaplanow|pokaz|sprawdz co|jak wyglada|kiedy mam|o ktorej mam|gdzie mam|czy mam|czy w|znajdz|wyszukaj|szukaj|poszukaj|what (?:do i have|have i scheduled|is on|does my|is coming)|when is|where is|show|find|search|look for|is there|do i have|check what)/u.test(outside);
 if(!free&&!read)return;
 const dates=calendarDateMentions(request,now),fields=calendarFields(request,now);
 const today=localDate(now);let start=dates[0],end=dates[1]||dates[0];
 if(/tygod|\bweek\b/u.test(text)) {start=addDays(today,-((now.getDay()+6)%7)+(/next|przysz|nastepn/u.test(text)?7:0));end=addDays(start,6);}
 if(/weekend/u.test(text)){start=addDays(today,(6-now.getDay()+7)%7);end=addDays(start,1);}
 if(start&&end&&end<start)return {result:{text:tr(lang,'Podaj poprawny zakres dat.','Specify a valid date range.')},selected:[],action:free?'assistant':'search'};
 if(!start&&!free&&!/^(?:znajdz|wyszukaj|szukaj|poszukaj|kiedy mam|o ktorej mam|gdzie mam|find|search|look for|when is|where is|pokaz|show)/u.test(text))return;
 if(free){
  if(!start)return;end||=start;
  let from=minutes(prefs.dayStart),to=minutes(prefs.dayEnd);
  if(/morning|rano|poran/u.test(text)){from=Math.max(from,6*60);to=Math.min(to,12*60);}
  if(/afternoon|po poludniu/u.test(text)){from=Math.max(from,12*60);to=Math.min(to,18*60);}
  if(/evening|wiecz/u.test(text)){from=Math.max(from,17*60);to=Math.min(to,22*60);}
  const range=text.match(/(?:between|miedzy|from|od)\s+(\d{1,2})(?::(\d{2}))?\s*(?:and|a|to|do)\s+(\d{1,2})(?::(\d{2}))?/u);
  if(range){from=Number(range[1])*60+Number(range[2]||0);to=Number(range[3])*60+Number(range[4]||0);}
  const duration=fields.duration??requestedDuration(request)??(/half hour|pol godziny/u.test(text)?30:Number(text.match(/\b(\d+)\s*(?:free |wolne )?(?:minutes|minut)/u)?.[1])||15);
  if(from>=to||from<0||to>=1440)return {result:{text:tr(lang,'Podaj poprawny zakres godzin.','Specify a valid time range.')},selected:[],action:'assistant'};
  const slots=availableSlots(events,start,end,duration,{...prefs,dayStart:timeString(from),dayEnd:timeString(to)},now);
  return {result:{text:tr(lang,'Wolne terminy:','Free slots:')+'\n'+(slots.map(s=>`${s.date} ${timeString(s.start)}–${timeString(s.end)}`).join('\n')||tr(lang,'Brak wolnych terminów.','No free slots.'))},selected:[],action:'assistant'};
 }
 let title='';
 const named=request.match(/^(?:znajd[źz]|wyszukaj|szukaj|poszukaj|kiedy mam|o kt[oó]rej mam|gdzie mam|find|search(?: for)?|look for|when is|where is|poka[żz]|show)\s+(.+)$/iu)?.[1];
 if(named&&!/^(?:mi |my |wszystko|everything|wydarzenia|events|plan|schedule|wolne|free)/iu.test(named)){
  title=calendarFields(named,now).rest.replace(/\s+(?:w moim kalendarzu|in my calendar|i jego miejsce|and its location).*$/iu,'').replace(/(?:[,;].*)|[?.!]$/gu,'').replace(/\s+(?:z|on|from)$/iu,'').trim().replace(/^["„“«]|["”»]$/gu,'');
 }
 if(!start&&!title)return;
 const candidates=title?searchCalendar(events,title):events;
 const selected=start?[...buildEventIndex(candidates,start,end||start).values()].flat():[];
 const after=text.match(/(?:\bpo|\bafter)\s+(\d{1,2})(?::(\d{2}))?/u);
 const occurrences=selected.filter(o=>!after||o.startMinutes>=Number(after[1])*60+Number(after[2]||0));
 const found=start?occurrences.map(o=>o.event):candidates;
 const unique=[...new Map(found.map(e=>[e.id,e])).values()];
 const lines=start?occurrences.slice(0,100).map(o=>`${o.event.title} — ${o.date} ${o.event.allDay?tr(lang,'cały dzień','all day'):timeString(o.startMinutes)+'–'+timeString(o.endMinutes)}`):unique.slice(0,100).map(e=>`${e.title} — ${e.startDate} ${e.startTime||''}–${e.endTime||''}${e.location?' · '+e.location:''}`);
 return {result:{text:lines.join('\n')||tr(lang,'Nie znaleziono wydarzeń.','No events found.')},selected:unique,action:'search'};
}
