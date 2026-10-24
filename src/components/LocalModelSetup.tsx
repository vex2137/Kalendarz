import { useEffect, useSyncExternalStore } from "react";
import type { AppLanguage } from "../utils/i18n";
import { localModelText } from "../utils/localModelText";
import { findModel } from "../utils/modelRegistry";
import {
  checkLocalModel,
  modelStatus,
  subscribeModel,
} from "../utils/localModelRuntime";
import { ModelManager } from "./ModelManager";
import { modelLifecycleText } from '../utils/modelLifecycleText';

export function LocalModelSetup({
  language,
  enabled = true,
}: {
  language: AppLanguage;
  enabled?: boolean;
}) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const descriptor = findModel(status.modelId),
    text = localModelText(language);
  useEffect(() => {
    void checkLocalModel();
  }, [status.modelId]);
  return (
    <section
      aria-label={descriptor.name}
      data-testid="local-model-setup"
      data-model-installed={status.installed}
      data-model-phase={status.phase}
      data-model-loaded={status.loaded}
      className="text-xs theme-text"
    >
        <p className="p-2">
          <span className="font-semibold">{descriptor.name}</span> ·{" "}
          <span role="status">{text[status.phase]}</span>
        </p>
        <p className="px-2 pb-2" data-testid="model-disk-ram">{modelLifecycleText(language).disk}: {status.installed ? modelLifecycleText(language).yes : modelLifecycleText(language).no} · {modelLifecycleText(language).ram}: {status.loaded ? modelLifecycleText(language).yes : modelLifecycleText(language).no}</p>
        <div className="p-3 space-y-2">
          {["downloading", "verifying"].includes(status.phase) && (
            <div>
              <progress
                className="w-full"
                value={status.progress}
                max={100}
                aria-label={text[status.phase]}
              />
              <span>{Math.floor(status.progress)}%</span>
            </div>
          )}
          <ModelManager language={language} enabled={enabled} />
          {descriptor.bundled && <p className="theme-muted">{text.note}</p>}
        </div>
    </section>
  );
}
