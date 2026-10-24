import { useEffect, useState, useSyncExternalStore } from "react";
import { AI_MODELS, DEFAULT_MODEL } from "../utils/modelRegistry";
import {
  hasDownloadedModelData,
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

export function ModelManager({
  language,
  enabled,
}: {
  language: AppLanguage;
  enabled: boolean;
}) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const [installed, setInstalled] = useState<string[]>([DEFAULT_MODEL.id]);
  const [error, setError] = useState(false);
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
        model.bundled ||
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
    setError(false);
    void fn().catch(() => setError(true));
  };
  return (
    <div className="space-y-3" aria-label={text.models}>
      <h4 className="font-semibold">{text.models}</h4>
      {AI_MODELS.map((model) => {
        const active = status.modelId === model.id;
        return (
          <article
            key={model.id}
            className="theme-border border rounded-lg p-2 space-y-1"
            data-model-id={model.id}
          >
            <p className="font-semibold">
              {model.name} {active && <span> · {text.selected}</span>}
            </p>
            <p>
              {(model.bytes / 1_000_000).toFixed(1)} MB · {text.memory}: ~
              {model.estimatedRamMB} MB
            </p>
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
                      accept=".gguf"
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
              {!model.bundled && installed.includes(model.id) && !busy && (
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
      {status.modelId !== DEFAULT_MODEL.id && (
        <button
          type="button"
          disabled={busy}
          className="theme-primary p-2 rounded disabled:opacity-50"
          onClick={() => perform(restoreFallbackModel)}
        >
          {text.fallback}
        </button>
      )}
      {status.phase === "error" && status.installed && !busy && (
        <button
          type="button"
          className="theme-border border rounded p-2"
          onClick={() => perform(retryLocalModel)}
        >
          {text.retry}
        </button>
      )}
      {(error || status.phase === "error") && (
        <p role="alert">{text.modelError}</p>
      )}
      <p className="theme-muted">{text.privacy}</p>
    </div>
  );
}
