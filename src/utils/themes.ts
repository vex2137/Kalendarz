import type { AppSettings, AppTheme, CustomTheme, ThemeColorKey } from '../types';
import themeSpec from './builtinThemes.json';

export const BUILTIN_THEMES = ['dark', 'light', 'contrast', 'ocean', 'nature', 'scifi', 'sunset', 'inferno', 'nord', 'emerald', 'lavender', 'moka'] as const;
export const OFFICIAL_THEMES = themeSpec.themes;
export const THEME_VARIABLES: Record<ThemeColorKey, string> = {
  background: '--bg-main', surface: '--bg-surface', header: '--bg-header', subtle: '--bg-subtle',
  hover: '--bg-hover', border: '--border-color', text: '--text-main', muted: '--text-muted',
  accent: '--accent-color', accentText: '--accent-text', button: '--button-bg', buttonHover: '--button-hover', buttonText: '--button-text',
};
export const DEFAULT_THEME_COLORS: CustomTheme['colors'] = builtinThemeColors('dark')!;
export function builtinThemeColors(id: string): CustomTheme['colors'] | undefined {
  const theme = OFFICIAL_THEMES.find(value => value.id === id);
  if (!theme) return undefined;
  return Object.fromEntries(themeSpec.fields.map((key, index) => [key, theme.colors[index]])) as CustomTheme['colors'];
}
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
  const colors = custom?.colors || builtinThemeColors(settings.theme);
  if (!colors) { delete root.dataset.palette; return; }
  root.dataset.palette = 'semantic';
  for (const [key, variable] of Object.entries(THEME_VARIABLES)) root.style.setProperty(variable, colors[key as ThemeColorKey]);
  const rgb = colors.background.slice(1).match(/../g)!.map(hex => parseInt(hex, 16));
  root.style.colorScheme = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 140 ? 'light' : 'dark';
}
