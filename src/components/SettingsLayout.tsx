import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Settings, Palette, Sparkles, Calendar, Bot, Shield, Database, Keyboard, Info } from 'lucide-react';
import type { AppLanguage } from '../utils/i18n';
import type { AppSettings } from '../types';
import { p3 } from '../utils/part3Text';
export const categories = {general:'General',appearance:'Appearance and themes',animations:'Animations',calendar:'Calendar',ai:'AI assistant',security:'Security',data:'Data and sync',shortcuts:'Keyboard shortcuts',updates:'Updates and about'} as const;
export type SettingsCategory=keyof typeof categories;
const descriptions={general:'Language and desktop layout',appearance:'Colors and custom themes',animations:'Effects and motion preferences',calendar:'Defaults, reminders and holidays',ai:'Assistant preferences and models',security:'PIN, password and biometric unlock',data:'Files, QR and text codes',shortcuts:'Bindings, conflicts and resets',updates:'Version, updates and MIT license'};
const icons={general:Settings,appearance:Palette,animations:Sparkles,calendar:Calendar,ai:Bot,security:Shield,data:Database,shortcuts:Keyboard,updates:Info};
const CategoryContext=createContext<SettingsCategory|null>(null);
export function SettingsOption({id,category,title,children}:{id:string;category:SettingsCategory;title:string;children:ReactNode}) {
 const selected=useContext(CategoryContext);
 return <section data-settings-option={id} data-category={category} data-title={title} id={`setting-${id}`} hidden={selected!==category} className="space-y-3 py-2">{children}</section>;
}
export function SettingsLayout({settings,onUpdateSettings,language,initialCategory,children,backRef}:{settings:AppSettings;onUpdateSettings:(s:AppSettings)=>boolean|void;language:AppLanguage;initialCategory?:string;children:ReactNode;backRef?:{current:()=>boolean}}) {
 const valid=(value?:string):SettingsCategory|null=>value&&value in categories?value as SettingsCategory:null;
 const [selected,setSelected]=useState<SettingsCategory|null>(()=>valid(initialCategory??settings.lastSettingsCategory));
 const [query,setQuery]=useState(''),[results,setResults]=useState<{id:string;category:SettingsCategory;title:string}[]>([]),[error,setError]=useState(false);
 const root=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(!backRef)return;const back=()=>{if(query){setQuery('');setResults([]);return true;}if(selected){setSelected(null);return true;}return false;};backRef.current=back;return()=>{if(backRef.current===back)backRef.current=()=>false;};},[query,selected,backRef]);
 useEffect(()=>{const category=valid(initialCategory);if(category&&category!==settings.lastSettingsCategory)setError(onUpdateSettings({...settings,lastSettingsCategory:category})===false);},[initialCategory]);
 const select=(category:SettingsCategory,id?:string)=>{
  setSelected(category);setQuery('');setResults([]);setError(onUpdateSettings({...settings,lastSettingsCategory:category})===false);
  requestAnimationFrame(()=>{const target=id?document.getElementById(id):content.current;target?.scrollIntoView({block:'nearest',behavior:'instant'});if(id){const input=target?.matches('input,button,select,textarea')?target:target?.querySelector<HTMLElement>('input,button,select,textarea');(input as HTMLElement|null)?.focus({preventScroll:true});}});
 };
 const search=(value:string)=>{
  setQuery(value);const q=value.trim().toLocaleLowerCase(language);if(!q){setResults([]);return;}
  const found:{id:string;category:SettingsCategory;title:string}[]=[];
  root.current?.querySelectorAll<HTMLElement>('[data-settings-option]').forEach(section=>{
   const category=section.dataset.category as SettingsCategory,title=section.dataset.title!;
   if(`${p3(language,categories[category])} ${title} ${section.textContent}`.toLocaleLowerCase(language).includes(q))found.push({id:section.id,category,title});
   section.querySelectorAll<HTMLElement>('label').forEach((field,index)=>{const label=field.textContent?.trim()||'';if(label&&label.toLocaleLowerCase(language).includes(q)){field.id ||= `${section.id}-field-${index}`;found.push({id:field.id,category,title:label});}});
  });setResults(found.slice(0,60));
 };
 const SelectedIcon=selected?icons[selected]:Settings;
 return <div ref={root} className="settings-layout min-h-0 flex flex-col flex-1" data-testid="settings-layout">
  <div className="p-3 space-y-2"><button type="button" className="underline text-sm" onClick={()=>{setSelected(null);setQuery('');}}>{p3(language,'All categories')}</button>
   <input id="settings-search" type="search" className="theme-input w-full p-3 rounded-xl" aria-label={p3(language,'Search settings')} placeholder={p3(language,'Search settings')} value={query} onChange={e=>search(e.target.value)}/>
   {error&&<p role="alert">{p3(language,'Could not save')}</p>}
  </div>
  {!!query&&<div className="overflow-auto p-3 space-y-2" data-testid="settings-results">{!results.length?<p role="status">{p3(language,'No results')}</p>:results.map(result=><button key={result.id} type="button" className="block text-left theme-input rounded-xl w-full p-3 break-words" onClick={()=>select(result.category,result.id)}>{result.title}<small className="block theme-muted">{p3(language,categories[result.category])}</small></button>)}</div>}
  {!selected&&!query&&<div className="settings-category-grid overflow-auto p-3" data-testid="settings-categories">{(Object.keys(categories) as SettingsCategory[]).map(category=>{const Icon=icons[category];return <button key={category} data-settings-category={category} type="button" className="theme-input theme-hover text-left p-4 rounded-2xl space-y-2" onClick={()=>select(category)}><strong className="flex items-center gap-2"><Icon size={18} className="shrink-0" aria-hidden="true"/>{p3(language,categories[category])}</strong><span className="text-xs theme-muted">{p3(language,descriptions[category])}</span></button>;})}</div>}
  <div className={`settings-category-body min-h-0 flex-1 ${!selected||query?'hidden':''}`}>
   <nav aria-label={p3(language,'All categories')} className="settings-category-nav p-3 overflow-auto">{(Object.keys(categories) as SettingsCategory[]).map(category=>{const Icon=icons[category];return <button key={category} data-settings-category={category} type="button" aria-current={selected===category?'page':undefined} className={`flex items-center gap-2 w-full text-left p-3 rounded-xl ${selected===category?'theme-primary':'theme-hover'}`} onClick={()=>select(category)}><Icon size={18} className="shrink-0" aria-hidden="true"/>{p3(language,categories[category])}</button>;})}</nav>
   <div ref={content} className="min-w-0 overflow-auto p-4 flex-1" data-testid="settings-category-content">{selected&&<h3 className="font-bold mb-3 flex items-center gap-2"><SelectedIcon size={18} className="shrink-0" aria-hidden="true"/>{p3(language,categories[selected])}</h3>}<CategoryContext.Provider value={selected}>{children}</CategoryContext.Provider></div>
  </div>
 </div>;
}
