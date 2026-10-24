import { AI_MODELS } from '../src/utils/modelRegistry';
import { writeFileSync } from 'node:fs';
const results = [];
for (const model of AI_MODELS) {
  const [owner, repo] = new URL(model.url).pathname.split('/').filter(Boolean);
  const response = await fetch(`https://huggingface.co/api/models/${owner}/${repo}/revision/${model.revision}?blobs=true`);
  if (!response.ok) throw new Error(`${model.id}: metadata HTTP ${response.status}`);
  const metadata = await response.json();
  const file = metadata.siblings?.find((file: {rfilename:string}) => file.rfilename === model.file);
  if (metadata.sha !== model.revision || file?.lfs?.sha256 !== model.sha256 || (file.size || file.lfs?.size) !== model.bytes) throw new Error(`${model.id}: pinned source metadata mismatch`);
  results.push({id:model.id,revision:metadata.sha,bytes:model.bytes,sha256:model.sha256,url:model.url,verified:true});
}
writeFileSync('model-source-recheck.json',JSON.stringify({checkedAt:new Date().toISOString(),models:results},null,2)+'\n');
console.log('All four pinned source revisions, exact sizes and SHA-256 metadata verified.');
