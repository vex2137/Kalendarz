import { storedCustomThemes, validThemeId, isCustomTheme } from './themes';
import type { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from './constants';
import { planningPreferences } from './assistantPlanning';
export function loadStoredSettings(): AppSettings {
  const raw = localStorage.getItem('offline_calendar_settings_v2');
  if (!raw) return DEFAULT_APP_SETTINGS;
  const parsed = JSON.parse(raw);
  const customThemes = storedCustomThemes(parsed.customThemes);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    customThemes,
    theme: validThemeId(parsed.theme, customThemes) ? parsed.theme : DEFAULT_APP_SETTINGS.theme,
    ai: { ...DEFAULT_APP_SETTINGS.ai, ...parsed.ai, planning: planningPreferences(parsed.ai?.planning) },
    language: parsed.language === 'pl' || parsed.language === 'ru' || parsed.language === 'de' ? parsed.language : 'en',
    security: { ...DEFAULT_APP_SETTINGS.security, ...parsed.security },
  };
}
export function saveStoredSettings(settings: AppSettings) {
  const themes = settings.customThemes || [];
  if (themes.length > 32 || themes.some(theme => !isCustomTheme(theme)) || new Set(themes.map(theme => theme.id)).size !== themes.length || !validThemeId(settings.theme, themes)) throw new Error('Invalid custom theme');
  localStorage.setItem(
    'offline_calendar_settings_v2',
    JSON.stringify(settings),
  );
}
