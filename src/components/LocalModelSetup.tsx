import { useEffect, useSyncExternalStore } from "react";
import type { AppLanguage } from "../utils/i18n";
import { findModel } from "../utils/modelRegistry";
import {
  checkLocalModel,
  modelStatus,
  subscribeModel,
} from "../utils/localModelRuntime";
import { ModelManager } from "./ModelManager";

export function LocalModelSetup({
  language,
  enabled = true,
  onDiagnostics,
}: {
  language: AppLanguage;
  enabled?: boolean;
  onDiagnostics?: () => void;
}) {
  const status = useSyncExternalStore(subscribeModel, modelStatus);
  const descriptor = findModel(status.modelId);
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
      <ModelManager language={language} enabled={enabled} onDiagnostics={onDiagnostics}/>
    </section>
  );
}
