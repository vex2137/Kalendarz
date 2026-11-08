import type { ModelStatus } from './localModelRuntime';
import type { ModelInstallationSnapshot, ModelInstallationState } from './localModelStore';

export type ModelDisplayState = ModelInstallationState | 'catalogue' | 'queued' | 'downloading' | 'loaded';
/** Selection, durable installation and engine residency are independent facts. */
export function modelPresentationState(id: string, bytes: number, status: ModelStatus & { installation?: ModelInstallationState; queued?: boolean }, disk?: ModelInstallationSnapshot) {
  const selected = status.modelId === id;
  let installation: ModelInstallationState = selected
    ? status.installation ?? (status.installed ? 'verified' : disk?.state ?? 'missing')
    : disk?.state ?? 'missing';
  const resumeBytes = selected ? status.resumeBytes ?? disk?.bytes ?? 0 : disk?.bytes ?? 0;
  if (installation === 'missing' && resumeBytes > 0) installation = resumeBytes === bytes ? 'unverified' : 'partial';
  const transferring = selected && (status.queued || status.phase === 'downloading' || status.phase === 'verifying');
  const installed = installation === 'verified';
  const loaded = selected && installed && status.loaded;
  let state: ModelDisplayState = loaded ? 'loaded' : installation === 'missing' ? 'catalogue' : installation;
  if (selected && !installed && status.queued) state = 'queued';
  else if (selected && !installed && status.phase === 'downloading' && !status.importing) state = 'downloading';
  else if (selected && !installed && status.phase === 'verifying') state = 'unverified';
  return { selected, installation, installed, loaded, state, resumeBytes,
    canUse: installed && !selected,
    canVerify: installation === 'unverified' && !transferring,
    canDownload: !installed && installation !== 'unverified' && !transferring,
    canResume: !installed && installation === 'partial' && resumeBytes > 0 && !transferring,
  };
}
