import { useState } from 'react';
import type { AnimationSettings, AppSettings } from '../types';
import { animationPreferences } from '../utils/animations';
import { tr, type AppLanguage } from '../utils/i18n';

export function AnimationSettingsPanel({settings, onUpdateSettings, language}: {
  settings: AppSettings; onUpdateSettings: (settings: AppSettings) => void; language: AppLanguage;
}) {
  const motion = animationPreferences(settings.animations);
  const [preview, setPreview] = useState(0);
  const set = (patch: Partial<AnimationSettings>) => onUpdateSettings({ ...settings, animations: animationPreferences({ ...motion, ...patch }) });
  const effects: [keyof Pick<AnimationSettings, 'confetti' | 'pinUnlock' | 'transitions' | 'buttons'>, string, string][] = [
    ['confetti', 'Konfetti (pełne animacje)', 'Confetti (full motion)'],
    ['pinUnlock', 'Animacja odblokowania PIN-em', 'PIN unlock animation'],
    ['transitions', 'Przejścia ekranów i widoków', 'Screen and view transitions'],
    ['buttons', 'Reakcje przycisków', 'Button feedback'],
  ];
  return <section className="space-y-3 pt-5" aria-label={tr(language, 'Animacje', 'Animations')}>
    <h4 className="text-sm font-bold theme-text">{tr(language, 'Animacje', 'Animations')}</h4>
    <label className="block text-xs theme-text">{tr(language, 'Poziom animacji', 'Animation level')}
      <select className="block w-full rounded-xl theme-input p-2" value={motion.level} onChange={e => set({level: e.target.value as AnimationSettings['level']})}>
        <option value="off">{tr(language, 'Wyłączone', 'Off')}</option>
        <option value="subtle">{tr(language, 'Subtelne', 'Subtle')}</option>
        <option value="full">{tr(language, 'Pełne', 'Full')}</option>
      </select>
    </label>
    <label className="block text-xs theme-text">{tr(language, 'Szybkość animacji', 'Animation speed')}: {motion.speed}%
      <input className="block w-full" type="range" min="50" max="200" step="10" value={motion.speed} onChange={e => set({speed: Number(e.target.value)})} />
    </label>
    {effects.map(([key, pl, en]) => <label key={key} className="flex items-center gap-2 text-xs theme-text"><input type="checkbox" checked={motion[key]} onChange={e => set({[key]: e.target.checked})}/>{tr(language, pl, en)}</label>)}
    <div className="flex items-center gap-3"><button type="button" className="theme-primary rounded-xl px-3 py-2 text-xs" onClick={() => setPreview(n => n + 1)}>{tr(language, 'Podgląd', 'Preview')}</button>
      {preview > 0 && <span key={preview} className="motion-preview theme-text" aria-hidden="true">✓</span>}
    </div>
    <p className="text-xs theme-muted">{tr(language, 'Systemowe ograniczenie ruchu ma pierwszeństwo.', 'System reduced-motion settings take priority.')}</p>
  </section>;
}
