import type { AppSettings } from '../types';
import { validateSync, type SyncPayload } from './sync';
/** The existing calendar commit is atomic. Stage only the shared theme preference;
 * compensate it if that transaction fails. Never touch credentials or AI models. */
export async function applySyncPayload(payload:SyncPayload,previous:AppSettings,save:(settings:AppSettings)=>void,commit:(payload:SyncPayload)=>Promise<void>,readLatest?:()=>AppSettings) {
 validateSync(payload);
 previous=readLatest?.()||previous;
 const next=payload.theme?{...previous,theme:payload.theme,...(payload.customTheme?{customThemes:[...(previous.customThemes||[]).filter(theme=>theme.id!==payload.customTheme!.id),payload.customTheme]}:{})}:previous;
 if(next!==previous)save(next);
 try{await commit(payload);}catch(error){
  if(next!==previous){
   const latest=readLatest?.()||next;
   let customThemes=latest.customThemes,unchanged=true;
   if(payload.customTheme){
    const imported=payload.customTheme,old=previous.customThemes?.find(theme=>theme.id===imported.id);
    // Undo only our exact theme revision. Keep other-window edits/additions.
    unchanged=JSON.stringify(latest.customThemes?.find(theme=>theme.id===imported.id))===JSON.stringify(imported);
    if(unchanged)
     customThemes=(latest.customThemes||[]).flatMap(theme=>theme.id===imported.id?(old?[old]:[]):[theme]);
   }
   const restored={...latest,theme:unchanged&&latest.theme===next.theme?previous.theme:latest.theme,...(payload.customTheme?{customThemes}:{})};
   save(restored);
  }
  throw error;
 }
 return readLatest?.()||next;
}
