import { AI_MODELS, type ModelDescriptor } from './modelRegistry';

// Resolve only audited catalogue artifacts. Never fetch an arbitrary pasted URL
// or trust its filename as evidence of engine compatibility.
export function modelsForHuggingFaceLink(value: string): readonly ModelDescriptor[] {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('model-link'); }
  if (url.protocol !== 'https:' || url.hostname !== 'huggingface.co' || url.username || url.password || url.port) throw new Error('model-link');
  const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('model-link');
  const repo = `/${parts[0]}/${parts[1]}`.toLowerCase();
  let matches = AI_MODELS.filter(model => new URL(model.url).pathname.toLowerCase().startsWith(repo + '/resolve/'));
  if (parts.length > 2) {
    if (!['blob', 'resolve', 'tree'].includes(parts[2]) || !parts[3]) throw new Error('model-link');
    matches = matches.filter(model => parts[3] === 'main' || parts[3] === model.revision);
    if (parts.length > 4) matches = matches.filter(model => parts.slice(4).join('/') === model.file);
    else if (parts[2] !== 'tree') throw new Error('model-link');
  }
  if (!matches.length) throw new Error('model-link-unsupported');
  return matches;
}
