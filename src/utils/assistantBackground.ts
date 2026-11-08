import { useSyncExternalStore } from 'react';
const key = 'calendar_ai_panel_background_v1';
const event = 'calendar-ai-background-setting';
export const assistantBackgroundEnabled = () => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } };
const read=assistantBackgroundEnabled;
export const keepModelLoaded = () => {try{return localStorage.getItem('calendar_ai_keep_model_loaded_v1')==='true';}catch{return false;}};
export function setKeepModelLoaded(value:boolean){localStorage.setItem('calendar_ai_keep_model_loaded_v1',String(value));window.dispatchEvent(new Event(event));}
export function setAssistantBackground(enabled: boolean) {
  localStorage.setItem(key, String(enabled));
  window.dispatchEvent(new Event(event));
}
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener); window.addEventListener('storage', listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener('storage', listener); };
};
export const useAssistantBackground = () => useSyncExternalStore(subscribe, read);
export const useKeepModelLoaded = () => useSyncExternalStore(subscribe, keepModelLoaded);
