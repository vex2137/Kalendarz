import type { AppSettings, AppTheme, CustomTheme, ThemeColorKey } from '../types';

export const BUILTIN_THEMES = ['light', 'dark', 'nord', 'emerald', 'sunset', 'lavender', 'moka'] as const;
export const THEME_VARIABLES: Record<ThemeColorKey, string> = {
  background: '--bg-main', surface: '--bg-surface', header: '--bg-header', subtle: '--bg-subtle',
  hover: '--bg-hover', border: '--border-color', text: '--text-main', muted: '--text-muted',
  accent: '--accent-color', accentText: '--accent-text', button: '--button-bg', buttonHover: '--button-hover', buttonText: '--button-text',
};
export const DEFAULT_THEME_COLORS: CustomTheme['colors'] = {
  background: '#09090b', surface: '#141416', header: '#141416', subtle: '#1f1f23', hover: '#27272d',
  border: '#2c2c34', text: '#fafafa', muted: '#a1a1aa', accent: '#3b82f6', accentText: '#ffffff',
  button: '#2563eb', buttonHover: '#1d4ed8', buttonText: '#ffffff',
};
export function isCustomTheme(value: unknown): value is CustomTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as CustomTheme;
  return typeof theme.id === 'string' && /^custom:[a-zA-Z0-9-]{1,64}$/.test(theme.id) &&
    typeof theme.name === 'string' && theme.name.trim().length > 0 && theme.name.length <= 50 &&
    Boolean(theme.colors) && (Object.keys(THEME_VARIABLES) as ThemeColorKey[]).every(key =>
      typeof theme.colors[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(theme.colors[key]));
}
export function storedCustomThemes(value: unknown): CustomTheme[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(theme => {
    if (!isCustomTheme(theme) || seen.has(theme.id) || seen.size >= 32) return false;
    seen.add(theme.id); return true;
  });
}
export function validThemeId(id: unknown, themes: CustomTheme[]): id is AppTheme {
  return typeof id === 'string' && ((BUILTIN_THEMES as readonly string[]).includes(id) || themes.some(theme => theme.id === id));
}
export function applyTheme(root: HTMLElement, settings: Pick<AppSettings, 'theme' | 'customThemes'>) {
  for (const variable of Object.values(THEME_VARIABLES)) root.style.removeProperty(variable);
  root.style.removeProperty('color-scheme');
  const custom = settings.customThemes?.find(theme => theme.id === settings.theme && isCustomTheme(theme));
  root.dataset.theme = custom?.id || ((BUILTIN_THEMES as readonly string[]).includes(settings.theme) ? settings.theme : 'dark');
  if (!custom) return;
  for (const [key, variable] of Object.entries(THEME_VARIABLES)) root.style.setProperty(variable, custom.colors[key as ThemeColorKey]);
  const rgb = custom.colors.background.slice(1).match(/../g)!.map(hex => parseInt(hex, 16));
  root.style.colorScheme = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 140 ? 'light' : 'dark';
}
