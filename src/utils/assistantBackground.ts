import { useSyncExternalStore } from 'react';
const key = 'calendar_ai_panel_background_v1';
const event = 'calendar-ai-background-setting';
const read = () => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } };
export function setAssistantBackground(enabled: boolean) {
  localStorage.setItem(key, String(enabled));
  window.dispatchEvent(new Event(event));
}
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener); window.addEventListener('storage', listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener('storage', listener); };
};
export const useAssistantBackground = () => useSyncExternalStore(subscribe, read);
