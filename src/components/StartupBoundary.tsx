import { Component, type ReactNode } from 'react';
import type { AppLanguage } from '../utils/i18n';
const copy={en:['Calendar could not safely open saved data.','Your stored data has not been reset. Restore a valid backup or correct the storage problem before retrying.','Restart and retry'],pl:['Kalendarz nie może bezpiecznie otworzyć zapisanych danych.','Zapisane dane nie zostały zresetowane. Przywróć poprawną kopię lub rozwiąż problem z pamięcią przed ponowieniem.','Uruchom ponownie'],de:['Gespeicherte Daten konnten nicht sicher geöffnet werden.','Die Daten wurden nicht zurückgesetzt. Stelle eine gültige Sicherung wieder her oder behebe das Speicherproblem.','Neu starten'],ru:['Не удалось безопасно открыть сохранённые данные.','Данные не сброшены. Восстановите корректную копию или устраните проблему хранилища перед повтором.','Перезапустить']};
/** Fail closed: never replace unreadable preferences with empty defaults. */
export class StartupBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(!this.state.failed)return this.props.children;
  let language:AppLanguage='en';try{const value=JSON.parse(localStorage.getItem('offline_calendar_settings_v2')||'{}').language;if(value==='pl'||value==='de'||value==='ru')language=value;}catch{/* Never render the parse error: it can contain credentials. */}
  const text=copy[language];
  return <main className="min-h-screen theme-surface theme-text p-6 flex flex-col justify-center items-center gap-4" role="alert" data-testid="startup-error"><h1 className="text-xl font-bold">{text[0]}</h1><p className="max-w-xl text-center">{text[1]}</p><code>app-startup-failed</code><button type="button" className="theme-primary p-3 rounded-xl" onClick={()=>location.reload()}>{text[2]}</button></main>;
 }
}
