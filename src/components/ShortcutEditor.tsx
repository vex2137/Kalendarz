import { useState } from 'react';
import type { AppSettings } from '../types';
import type { AppLanguage } from '../utils/i18n';
import { p3 } from '../utils/part3Text';
import { defaultShortcuts, normalizedShortcuts, validShortcutKey, reservedShortcut, shortcutConflicts, shortcutKey, type ShortcutAction } from '../utils/shortcuts';
export function ShortcutEditor({settings, onUpdateSettings, language}:{settings:AppSettings;onUpdateSettings:(settings:AppSettings)=>boolean|void;language:AppLanguage}) {
 const [draft,setDraft]=useState(()=>normalizedShortcuts(settings.keyboardShortcuts)),[capture,setCapture]=useState<ShortcutAction>(),[status,setStatus]=useState('');
 const conflicts=shortcutConflicts(draft);
 return <section data-testid="shortcut-editor" className="space-y-3"><p className="text-xs theme-muted">{p3(language,'System shortcuts may be intercepted by the OS or browser.')}</p>
  {(Object.keys(draft) as ShortcutAction[]).map(action=><div key={action} className="theme-border border-b py-2 flex flex-wrap gap-2 items-center"><span className="flex-1 min-w-36">{p3(language,action)}</span>
   {draft[action].map(key=><button type="button" key={key} aria-label={`${p3(language,'Disable')} ${key}`} className="theme-input rounded px-2 py-1" onClick={()=>setDraft({...draft,[action]:draft[action].filter(k=>k!==key)})}><kbd>{key}</kbd> ×</button>)}
   <button type="button" aria-label={`${p3(language,'Add binding')}: ${p3(language,action)}`} className="theme-input rounded p-2 text-xs" onClick={()=>{setCapture(action);setStatus('');}}>{p3(language,'Add binding')}</button>
   <button type="button" aria-label={`${p3(language,'Reset')}: ${p3(language,action)}`} className="underline text-xs" onClick={()=>setDraft({...draft,[action]:defaultShortcuts()[action]})}>{p3(language,'Reset')}</button>
  </div>)}
  {capture&&<label className="block">{p3(language,'Press a new shortcut')}: {p3(language,capture)}<input autoFocus data-shortcut-capture readOnly aria-label={p3(language,'Press a new shortcut')} className="theme-input w-full p-3" value="" onKeyDown={e=>{
    e.preventDefault();e.stopPropagation();if(e.nativeEvent.isComposing)return;if(e.key==='Escape'){setCapture(undefined);return;}
    const key=shortcutKey(e.nativeEvent);if(!key)return;
    if(reservedShortcut(key)){setStatus(p3(language,'Reserved shortcut'));return;}
    const next={...draft,[capture]:[...new Set([...draft[capture],key])]};
    if(!validShortcutKey(key)){setStatus(p3(language,'Reserved shortcut'));return;}
    setDraft(next);setCapture(undefined);setStatus('');
  }}/></label>}
  {!!conflicts.length&&<p role="alert">{p3(language,'Conflicting shortcuts')}: {conflicts.map(text=>text.replace(/: (\w+) \/ (\w+)$/,(_,a,b)=>`: ${p3(language,a)} / ${p3(language,b)}`)).join('; ')}</p>}
  <p role="status">{status}</p><div className="flex flex-wrap gap-2"><button type="button" className="theme-primary rounded p-2" disabled={!!conflicts.length||!!capture} onClick={()=>setStatus(onUpdateSettings({...settings,keyboardShortcuts:draft})===false?p3(language,'Could not save'):p3(language,'Saved'))}>{p3(language,'Save shortcuts')}</button>
  <button type="button" className="theme-input rounded p-2" onClick={()=>{if(window.confirm(p3(language,'Reset these preferences? Saved themes and all other data will remain.')))setDraft(defaultShortcuts());}}>{p3(language,'Reset category')}</button></div>
 </section>;
}
