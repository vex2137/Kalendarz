import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppLanguage } from "../utils/i18n";
import { localModelText } from "../utils/localModelText";
import { findModel } from "../utils/modelRegistry";
import {
  checkLocalModel,
  modelStatus,
  subscribeModel,
} from "../utils/localModelRuntime";
import { ModelManager } from "./ModelManager";

const expansionKey = "calendar_model_info_expanded_v1";
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
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(expansionKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    void checkLocalModel();
  }, [status.modelId]);
  return (
    <section
      aria-label={descriptor.name}
      data-testid="local-model-setup"
      data-model-installed={status.installed}
      data-model-phase={status.phase}
      className="min-h-0 max-h-[30vh] overflow-y-auto text-xs theme-border border-b theme-text"
    >
      <details
        open={expanded}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setExpanded(open);
          try {
            localStorage.setItem(expansionKey, String(open));
          } catch {}
        }}
      >
        <summary className="p-2 cursor-pointer">
          <span className="font-semibold">{descriptor.name}</span> ·{" "}
          <span role="status">{text[status.phase]}</span>
          {status.installed ? " · OFFLINE" : ""}
        </summary>
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
      </details>
    </section>
  );
}
