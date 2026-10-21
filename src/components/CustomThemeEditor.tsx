import React, { useState } from 'react';
import type { AppSettings, CustomTheme, ThemeColorKey } from '../types';
import { DEFAULT_THEME_COLORS, THEME_VARIABLES, isCustomTheme } from '../utils/themes';
import { featureText as ft } from '../utils/featureCopy';

const fields: Record<ThemeColorKey, Parameters<typeof ft>[1]> = {
  background: 'Background', surface: 'Panels', header: 'Header', subtle: 'Secondary background', hover: 'Hover background',
  border: 'Borders', text: 'Text', muted: 'Secondary text', accent: 'Accent', accentText: 'Text on accent',
  button: 'Buttons', buttonHover: 'Button hover', buttonText: 'Button text',
};
function luminance(hex: string) {
  return hex.slice(1).match(/../g)!.map(value => {
    const v = parseInt(value, 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function CustomThemeEditor({ settings, onUpdateSettings }: {
  settings: AppSettings; onUpdateSettings: (settings: AppSettings) => boolean | void;
}) {
  const language = settings.language || 'en';
  const themes = settings.customThemes || [];
  const [draft, setDraft] = useState<CustomTheme | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [error, setError] = useState('');
  function create() {
    if (themes.length >= 32) { setError(ft(language, 'You can save up to 32 custom themes.')); return; }
    const style = getComputedStyle(document.documentElement);
    const colors = { ...DEFAULT_THEME_COLORS };
    for (const [key, variable] of Object.entries(THEME_VARIABLES)) {
      const value = style.getPropertyValue(variable).trim();
      if (/^#[a-fA-F0-9]{6}$/.test(value)) colors[key as ThemeColorKey] = value;
    }
    setDraft({ id: `custom:${crypto.randomUUID()}`, name: ft(language, 'New theme'), colors });
    setError('');
  }
  function save() {
    if (!draft) return;
    const value = { ...draft, name: draft.name.trim() };
    if (!isCustomTheme(value)) { setError(ft(language, 'Enter a name of up to 50 characters.')); return; }
    const customThemes = [...themes.filter(theme => theme.id !== value.id), value];
    if (onUpdateSettings({ ...settings, customThemes, theme: value.id }) === false) { setError(ft(language, 'Could not save the theme.')); return; }
    setDraft(null); setError('');
  }
  const pairs = draft ? [
    [draft.colors.text, draft.colors.background], [draft.colors.text, draft.colors.surface],
    [draft.colors.text, draft.colors.header], [draft.colors.buttonText, draft.colors.button],
    [draft.colors.accentText, draft.colors.accent],
  ] : [];
  const contrast = Math.min(21, ...pairs.map(([text, background]) =>
    (Math.max(luminance(text), luminance(background)) + 0.05) / (Math.min(luminance(text), luminance(background)) + 0.05)));
  return <section className="space-y-3 pt-4" aria-label={ft(language, 'Custom themes')}>
    <h5 className="text-sm font-bold">{ft(language, 'Custom themes')}</h5>
    <div className="space-y-2">
      {themes.map(theme => <div key={theme.id} className="flex flex-wrap items-center gap-2 theme-border border rounded-xl p-2">
        <button type="button" aria-pressed={settings.theme === theme.id} className="flex-1 min-w-0 text-left break-words rounded p-2"
          style={{ backgroundColor: theme.colors.background, color: theme.colors.text, border: `2px solid ${theme.colors.accent}` }}
          onClick={() => onUpdateSettings({ ...settings, theme: theme.id })}>{theme.name}</button>
        <button type="button" className="text-xs underline" aria-label={`${ft(language, 'Edit theme')}: ${theme.name}`} onClick={() => { setDraft(structuredClone(theme)); setError(''); }}>{ft(language, 'Edit theme')}</button>
        <button type="button" className="text-xs underline" aria-label={`${ft(language, 'Delete theme')}: ${theme.name}`} onClick={() => setRemove(theme.id)}>{ft(language, 'Delete theme')}</button>
        {remove === theme.id && <div className="w-full flex flex-wrap gap-2 text-xs">
          <p>{ft(language, 'Delete this theme?')}</p>
          <button type="button" className="underline" onClick={() => {
            const next = { ...settings, customThemes: themes.filter(value => value.id !== theme.id), theme: settings.theme === theme.id ? 'dark' as const : settings.theme };
            if (onUpdateSettings(next) !== false) { setRemove(null); if (draft?.id === theme.id) setDraft(null); }
          }}>{ft(language, 'Delete')}</button>
          <button type="button" className="underline" onClick={() => setRemove(null)}>{ft(language, 'Cancel')}</button>
        </div>}
      </div>)}
    </div>
    {!draft ? <button type="button" className="theme-input rounded-xl p-2 text-xs" onClick={create}>{ft(language, 'Create theme')}</button> :
      <div className="space-y-3 theme-border border rounded-xl p-3">
        <label className="block text-xs">{ft(language, 'Theme name')}<input className="theme-input w-full rounded p-2 mt-1" maxLength={50} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
          {(Object.keys(fields) as ThemeColorKey[]).map(key => <label key={key} className="flex items-center justify-between gap-2 text-xs">
            <span>{ft(language, fields[key])}</span><input type="color" className="w-10 h-9 shrink-0" value={draft.colors[key]} onChange={e => setDraft({ ...draft, colors: { ...draft.colors, [key]: e.target.value } })} />
          </label>)}
        </div>
        <div aria-label={ft(language, 'Theme preview')} className="rounded-xl border p-3 space-y-2" style={{ backgroundColor: draft.colors.background, color: draft.colors.text, borderColor: draft.colors.border }}>
          <p>{ft(language, 'Theme preview')}</p>
          <p style={{ color: draft.colors.muted }}>{draft.name}</p>
          <span className="inline-block rounded p-2" style={{ backgroundColor: draft.colors.button, color: draft.colors.buttonText }}>{ft(language, 'Buttons')}</span>
        </div>
        {contrast < 4.5 && <p className="text-xs" role="status">{ft(language, 'Low text contrast: adjust the text or background colors.')}</p>}
        <div className="flex gap-2"><button type="button" className="theme-primary bg-blue-600 text-white text-xs rounded p-2" onClick={save}>{ft(language, 'Save theme')}</button>
          <button type="button" className="theme-input text-xs rounded p-2" onClick={() => { setDraft(null); setError(''); }}>{ft(language, 'Cancel')}</button></div>
      </div>}
    {error && <p role="alert" className="text-xs">{error}</p>}
  </section>;
}
