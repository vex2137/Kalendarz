import type { AppSettings } from '../types';
import { validateSync, type SyncPayload } from './sync';
/** The existing calendar commit is atomic. Stage only the shared theme preference;
 * compensate it if that transaction fails. Never touch credentials or AI models. */
export async function applySyncPayload(payload:SyncPayload,previous:AppSettings,save:(settings:AppSettings)=>void,commit:(payload:SyncPayload)=>Promise<void>) {
 validateSync(payload);
 const next=payload.theme?{...previous,theme:payload.theme,customThemes:payload.customTheme?[...(previous.customThemes||[]).filter(theme=>theme.id!==payload.customTheme!.id),payload.customTheme]:previous.customThemes}:previous;
 if(next!==previous)save(next);
 try{await commit(payload);}catch(error){if(next!==previous)save(previous);throw error;}
 return next;
}
