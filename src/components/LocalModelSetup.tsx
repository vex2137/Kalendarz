import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppLanguage } from '../utils/i18n';
import { localModelText } from '../utils/localModelText';
import { LOCAL_MODEL } from '../utils/localModelManifest';
import { cancelModelOperation, checkLocalModel, deleteLocalModel, installLocalModel, modelStatus, subscribeModel } from '../utils/localModelRuntime';

export function LocalModelSetup({ language, enabled = true }: { language: AppLanguage; enabled?: boolean }) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [storageError, setStorageError] = useState(false);
  const text = localModelText(language);
  useEffect(() => { void checkLocalModel(); }, []);
  const busy = ['checking', 'downloading', 'verifying', 'loading', 'running'].includes(status.phase);
  return <section aria-label={LOCAL_MODEL.name} data-testid="local-model-setup" data-model-installed={status.installed} data-model-phase={status.phase} className="p-3 text-xs theme-border border-b space-y-2 theme-text">
    <p className="font-semibold">{LOCAL_MODEL.name} · llama.cpp</p>
    <p role="status">{text[status.phase]}</p>
    {['downloading', 'verifying'].includes(status.phase) && <div>
      <progress className="w-full" value={status.progress} max={100} aria-label={text[status.phase]} />
      <span>{Math.floor(status.progress)}%</span>
    </div>}
    {(status.phase === 'error' || storageError) && <p role="alert">{text.failure}</p>}
    <div className="flex flex-wrap gap-2">
      {!status.installed && !busy && <>
        <button type="button" disabled={!enabled} className="theme-primary px-3 py-2 rounded disabled:opacity-50" onClick={() => { setStorageError(false); void installLocalModel(); }}>{text.download}</button>
        <label className={`theme-surface theme-border border rounded px-3 py-2 ${enabled ? 'cursor-pointer' : 'opacity-50'}`}>
          {text.import}
          <input type="file" accept=".gguf" className="sr-only" aria-label={text.import} disabled={!enabled} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void installLocalModel(file); }} />
        </label>
      </>}
      {busy && status.phase !== 'checking' && <button type="button" className="theme-border border px-3 py-2 rounded" onClick={cancelModelOperation}>{text.cancel}</button>}
      {status.installed && !status.bundled && !busy && <button type="button" className="theme-border border px-3 py-2 rounded" onClick={() => { setStorageError(false); void deleteLocalModel().catch(() => setStorageError(true)); }}>{text.remove}</button>}
    </div>
    <p className="theme-muted">{text.note}</p>
  </section>;
}
