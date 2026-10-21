import type { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from './constants';
import { planningPreferences } from './assistantPlanning';
export function loadStoredSettings(): AppSettings {
  const raw = localStorage.getItem('offline_calendar_settings_v2');
  if (!raw) return DEFAULT_APP_SETTINGS;
  const parsed = JSON.parse(raw);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    ai: { ...DEFAULT_APP_SETTINGS.ai, ...parsed.ai, planning: planningPreferences(parsed.ai?.planning) },
    language: parsed.language === 'pl' || parsed.language === 'ru' ? parsed.language : 'en',
    security: { ...DEFAULT_APP_SETTINGS.security, ...parsed.security },
  };
}
export function saveStoredSettings(settings: AppSettings) {
  localStorage.setItem(
    'offline_calendar_settings_v2',
    JSON.stringify(settings),
  );
}
