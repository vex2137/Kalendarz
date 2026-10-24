import { useEffect, useState, useSyncExternalStore } from "react";
import { AI_MODELS, PREFERRED_MODEL } from "../utils/modelRegistry";
import {
  hasDownloadedModelData,
  bundledModelAvailable,
  removeSavedModel,
} from "../utils/localModelStore";
import {
  cancelModelOperation,
  deleteLocalModel,
  installLocalModel,
  modelStatus,
  restoreFallbackModel,
  retryLocalModel,
  selectLocalModel,
  subscribeModel,
} from "../utils/localModelRuntime";
import { assistantUiText } from "../utils/assistantUiText";
import type { AppLanguage } from "../utils/i18n";
import { Capacitor } from '@capacitor/core';
import { modelsForHuggingFaceLink } from '../utils/modelLinks';
import { aiSettingsText, modelErrorText } from '../utils/aiSettingsText';
import { modelLifecycleText } from '../utils/modelLifecycleText';

export function ModelManager({
  language,
  enabled,
}: {
  language: AppLanguage;
  enabled: boolean;
}) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [installed, setInstalled] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [link, setLink] = useState('');
  const [matches, setMatches] = useState<readonly string[]>();
  const settings = aiSettingsText(language);
  const text = assistantUiText(language);
  const busy = [
    "checking",
    "downloading",
    "verifying",
    "loading",
    "running",
  ].includes(status.phase);
  useEffect(() => {
    let current = true;
    void Promise.all(
      AI_MODELS.map(async (model) =>
        (model.bundled && await bundledModelAvailable(model)) ||
        (await hasDownloadedModelData(model).catch(() => false))
          ? model.id
          : "",
      ),
    ).then((ids) => {
      if (current) setInstalled(ids.filter(Boolean));
    });
    return () => {
      current = false;
    };
  }, [status.phase, status.modelId]);
  const perform = (fn: () => Promise<unknown>) => {
    setError(undefined);
    void fn().catch(error => setError(error instanceof Error ? error.message : 'model-inference'));
  };
  return (
    <div className="space-y-3" aria-label={text.models}>
      <h4 className="font-semibold">{text.models}</h4>
      {!installed.includes(PREFERRED_MODEL.id) && !(status.modelId===PREFERRED_MODEL.id&&status.installed) && <p className="theme-muted">{modelLifecycleText(language).offer}</p>}
      <form className="space-y-2" onSubmit={event => {
        event.preventDefault(); setError(undefined);
        try { setMatches(modelsForHuggingFaceLink(link).map(model => model.id)); }
        catch (error) { setMatches(undefined); setError((error as Error).message); }
      }}>
        <label className="block">{settings.link}<input type="url" aria-label={settings.link} value={link} onChange={event => setLink(event.target.value)} className="theme-input w-full rounded p-2" placeholder="https://huggingface.co/…" required /></label>
        <button type="submit" disabled={busy} className="theme-border border rounded p-2 disabled:opacity-50">{settings.resolve}</button>
        {matches && <button type="button" onClick={() => {setMatches(undefined);setLink('');}} className="underline ml-2">{text.models}</button>}
        <p className="theme-muted">{settings.hint}</p>
      </form>
      {[...AI_MODELS].sort((a,b)=>Number(b.id===PREFERRED_MODEL.id)-Number(a.id===PREFERRED_MODEL.id)).filter(model => !matches || matches.includes(model.id)).map((model) => {
        const active = status.modelId === model.id;
        const onDisk = installed.includes(model.id) || active && status.installed;
        return (
          <article
            key={model.id}
            className="theme-border border rounded-lg p-2 space-y-1"
            data-model-id={model.id}
          >
            <p className="font-semibold">
              {model.name} {active && <span> · {text.selected}</span>}
            </p>
            {model.id === PREFERRED_MODEL.id && <p className="font-semibold theme-muted">{modelLifecycleText(language).preferred}</p>}
            <p>
              {(model.bytes / 1_000_000).toFixed(1)} MB · {text.memory}: ~
              {model.estimatedRamMB} MB
            </p>
            {onDisk && <p role="status">{settings.installed}</p>}
            {model.experimental && (
              <p className="theme-muted">{text.experimental}</p>
            )}
            <a
              className="underline"
              href={model.license}
              target="_blank"
              rel="noreferrer"
            >
              {text.source}: {model.licenseName}
            </a>
            <a
              className="underline ml-2"
              href={model.url.split("/resolve/")[0]}
              target="_blank"
              rel="noreferrer"
            >
              {new URL(model.url).pathname.split("/")[1]}
            </a>
            <div className="flex flex-wrap gap-2">
              {!active && (
                <button
                  type="button"
                  disabled={busy || !enabled}
                  className="theme-border border rounded p-2 disabled:opacity-50"
                  onClick={() => perform(() => selectLocalModel(model.id))}
                >
                  {text.select}
                </button>
              )}
              {active && !status.installed && !busy && (
                <>
                  <button
                    type="button"
                    disabled={!enabled}
                    className="theme-primary rounded p-2"
                    onClick={() => perform(() => installLocalModel())}
                  >
                    {text.download}
                  </button>
                  <label className="theme-border border rounded p-2 cursor-pointer">
                    {text.import}
                    <input
                      type="file"
                      className="sr-only"
                      accept={Capacitor.getPlatform() === 'android' ? undefined : '.gguf,application/octet-stream'}
                      disabled={!enabled}
                      aria-label={text.import}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) perform(() => installLocalModel(file));
                      }}
                    />
                  </label>
                </>
              )}
              {!model.bundled && onDisk && !busy && (
                <button
                  type="button"
                  className="theme-border border rounded p-2"
                  onClick={() =>
                    perform(async () => {
                      if (active) await deleteLocalModel();
                      else await removeSavedModel(model);
                      setInstalled((ids) =>
                        ids.filter((id) => id !== model.id),
                      );
                    })
                  }
                >
                  {text.remove}
                </button>
              )}
            </div>
          </article>
        );
      })}
      {busy && status.phase !== "checking" && (
        <button
          type="button"
          className="theme-border border p-2 rounded"
          onClick={cancelModelOperation}
        >
          {text.cancel}
        </button>
      )}
      {!AI_MODELS.find(model=>model.id===status.modelId)?.bundled && (
        <button
          type="button"
          disabled={busy}
          className="theme-primary p-2 rounded disabled:opacity-50"
          onClick={() => perform(restoreFallbackModel)}
        >
          {text.fallback}
        </button>
      )}
      {status.phase === "error" && !busy && (
        <button
          type="button"
          className="theme-border border rounded p-2"
          onClick={() => perform(retryLocalModel)}
        >
          {text.retry}
        </button>
      )}
      {(error || status.phase === "error") && (
        <p role="alert">{modelErrorText(error || status.error, language)} {status.installed && modelLifecycleText(language).retry}</p>
      )}
      <p className="theme-muted">{text.privacy}</p>
    </div>
  );
}
