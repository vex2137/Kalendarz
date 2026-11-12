import { useMemo, useRef } from 'react';
import type { AppSettings,CalendarEvent } from '../types';
import { p3 } from '../utils/part3Text';
import { monthDates } from '../utils/calendarLayout';
import { buildEventIndex } from '../utils/recurrence';
import { localDate, addDays } from '../utils/dates';
import { DAY_NAMES_SHORT, MONTH_NAMES, type AppLanguage } from '../utils/i18n';
export function DesktopSidebar({settings,onUpdateSettings,date,events,language,onDate,onEvent}:{settings:AppSettings;onUpdateSettings:(s:AppSettings)=>boolean|void;date:Date;events:CalendarEvent[];language:AppLanguage;onDate:(date:string)=>void;onEvent:(event:CalendarEvent)=>void}) {
 const width=settings.desktop?.width??256,range=useRef<{start:number;width:number}|undefined>(undefined);
 const today=localDate(),days=monthDates(date,1);
 const upcoming=useMemo(()=>[...buildEventIndex(events,today,addDays(today,30)).entries()].flatMap(([day,items])=>items.map(item=>({day,...item}))).slice(0,15),[events,today]);
 return <aside className="desktop-sidebar theme-surface theme-border" style={{width}} data-testid="desktop-sidebar">
  <button type="button" className="theme-input rounded p-2 mb-3 w-full" onClick={()=>onUpdateSettings({...settings,desktop:{sidebar:false,width}})}>{p3(language,'Desktop sidebar')} ×</button>
  <strong>{MONTH_NAMES[language][date.getMonth()]} {date.getFullYear()}</strong><div className="year-weekdays">{DAY_NAMES_SHORT[language].map(d=><span key={d}>{d}</span>)}</div>
  <div className="year-dates">{days.map(day=><button key={day} type="button" className={`${day===today?'calendar-today':''} ${Number(day.slice(5,7))!==date.getMonth()+1?'theme-muted':''}`} onClick={()=>onDate(day)} aria-label={day} aria-current={day===today?'date':undefined}>{Number(day.slice(-2))}</button>)}</div>
  <h3 className="font-semibold mt-5 mb-2">{p3(language,'Upcoming events')}</h3>{!upcoming.length&&<p className="text-xs theme-muted">{p3(language,'No events in the next 30 days.')}</p>}
  {upcoming.map(item=><button type="button" key={`${item.event.id}:${item.day}`} onClick={()=>onEvent(item.event)} className="block text-left w-full rounded p-2 theme-hover text-xs break-words"><span className="block theme-muted">{item.day} {item.event.startTime}</span>{item.event.title}</button>)}
  <div role="separator" aria-orientation="vertical" aria-label={p3(language,'Panel width')} tabIndex={0} aria-valuemin={220} aria-valuemax={360} aria-valuenow={width} className="sidebar-resize" onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();onUpdateSettings({...settings,desktop:{sidebar:true,width:Math.max(220,Math.min(360,width+(e.key==='ArrowRight'?10:-10)))}});}}} onPointerDown={e=>{range.current={start:e.clientX,width};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const start=range.current;if(start)e.currentTarget.parentElement!.style.width=`${Math.max(220,Math.min(360,start.width+e.clientX-start.start))}px`;}} onPointerUp={e=>{const start=range.current;range.current=undefined;if(start){e.currentTarget.parentElement!.style.width=`${width}px`;onUpdateSettings({...settings,desktop:{sidebar:true,width:Math.max(220,Math.min(360,start.width+e.clientX-start.start))}});}}} onPointerCancel={e=>{range.current=undefined;e.currentTarget.parentElement!.style.width=`${width}px`;}} onLostPointerCapture={e=>{if(range.current){range.current=undefined;e.currentTarget.parentElement!.style.width=`${width}px`;}}}/>
 </aside>;
}
