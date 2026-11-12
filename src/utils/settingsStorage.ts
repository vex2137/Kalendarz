import { normalizedShortcuts, shortcutConflicts } from './shortcuts';
import { storedCustomThemes, validThemeId, isCustomTheme } from './themes';
import type { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from './constants';
import { planningPreferences } from './assistantPlanning';
import { animationPreferences } from './animations';
export function loadStoredSettings(): AppSettings {
  const raw = localStorage.getItem('offline_calendar_settings_v2');
  if (!raw) return DEFAULT_APP_SETTINGS;
  const parsed = JSON.parse(raw);
  const customThemes = storedCustomThemes(parsed.customThemes);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    customThemes,
    keyboardShortcuts: normalizedShortcuts(parsed.keyboardShortcuts),
    desktop: {sidebar: parsed.desktop?.sidebar===true, width: Math.max(220,Math.min(360,Math.round(Number(parsed.desktop?.width)||256)))},
    theme: validThemeId(parsed.theme, customThemes) ? parsed.theme : DEFAULT_APP_SETTINGS.theme,
    ai: { ...DEFAULT_APP_SETTINGS.ai, ...parsed.ai, planning: planningPreferences(parsed.ai?.planning) },
    language: parsed.language === 'pl' || parsed.language === 'ru' || parsed.language === 'de' ? parsed.language : 'en',
    security: { ...DEFAULT_APP_SETTINGS.security, ...parsed.security },
    animations: animationPreferences(parsed.animations),
  };
}
export function saveStoredSettings(settings: AppSettings) {
  if(settings.keyboardShortcuts && (shortcutConflicts(settings.keyboardShortcuts).length || Object.keys(normalizedShortcuts(settings.keyboardShortcuts)).some(action=>JSON.stringify(normalizedShortcuts(settings.keyboardShortcuts)[action as keyof typeof settings.keyboardShortcuts])!==JSON.stringify(settings.keyboardShortcuts![action as keyof typeof settings.keyboardShortcuts]))))throw Error('Invalid shortcut configuration');
  const themes = settings.customThemes || [];
  if (themes.length > 32 || themes.some(theme => !isCustomTheme(theme)) || new Set(themes.map(theme => theme.id)).size !== themes.length || !validThemeId(settings.theme, themes)) throw new Error('Invalid custom theme');
  localStorage.setItem(
    'offline_calendar_settings_v2',
    JSON.stringify(settings),
  );
}
