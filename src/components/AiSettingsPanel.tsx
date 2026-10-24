import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { AppLanguage } from '../utils/i18n';
import { assistantUiText } from '../utils/assistantUiText';
import { aiSettingsText } from '../utils/aiSettingsText';
import { LocalModelSetup } from './LocalModelSetup';
import { ModelDiagnostics } from './ModelDiagnostics';

export function AiSettingsPanel({ language, enabled, onClose }: { language: AppLanguage; enabled: boolean; onClose: () => void }) {
  const [tab, setTab] = useState('models');
  const close = useRef<HTMLButtonElement>(null);
  const text = aiSettingsText(language), ui = assistantUiText(language);
  useEffect(() => { close.current?.focus(); }, []);
  return <section id="ai-settings-panel" aria-label={text.settings} className="absolute inset-0 sm:inset-8 sm:mx-auto sm:max-w-3xl sm:rounded-2xl theme-surface theme-text theme-border border shadow-2xl flex flex-col min-h-0">
    <header className="px-4 py-2 flex shrink-0 items-center justify-between"><h3 className="font-semibold">{text.settings}</h3><button ref={close} type="button" onClick={onClose} aria-label={ui.close} className="w-11 h-11 flex items-center justify-center theme-hover rounded-lg"><X className="w-6 h-6" /></button></header>
    <div className="px-3 pb-3 shrink-0"><div role="tablist" aria-label={text.settings} className="flex theme-subtle rounded-xl p-1 gap-1 theme-border border" onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 'models' : event.key === 'End' ? 'diagnostics' : tab === 'models' ? 'diagnostics' : 'models'; setTab(next); document.getElementById(`ai-tab-${next}`)?.focus();
      }
    }}>
      {(['models', 'diagnostics'] as const).map(id => <button key={id} id={`ai-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`ai-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} className={`flex-1 min-w-0 min-h-11 px-2 py-2 rounded-lg text-sm font-semibold ${tab === id ? 'theme-primary bg-violet-600 text-white shadow-sm' : 'theme-muted theme-hover'}`}>{id === 'models' ? ui.models : text.diagnostics}</button>)}
    </div></div>
    <div id="ai-panel-models" role="tabpanel" aria-labelledby="ai-tab-models" hidden={tab !== 'models'} className="min-h-0 flex-1 overflow-y-auto p-3"><LocalModelSetup language={language} enabled={enabled}/></div>
    <div id="ai-panel-diagnostics" role="tabpanel" aria-labelledby="ai-tab-diagnostics" hidden={tab !== 'diagnostics'} className="min-h-0 flex-1 overflow-y-auto"><ModelDiagnostics language={language} enabled={enabled}/></div>
  </section>;
}
