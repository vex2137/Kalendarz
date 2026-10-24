import test from 'node:test';
import assert from 'node:assert/strict';
import { modelsForHuggingFaceLink } from '../src/utils/modelLinks';
import { AI_MODELS } from '../src/utils/modelRegistry';
test('HF links resolve only audited exact catalogue artifacts', () => {
  const repo = 'https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF';
  assert.equal(modelsForHuggingFaceLink(repo).length, 2);
  assert.equal(modelsForHuggingFaceLink(repo+'/tree/main').length, 2);
  for (const model of AI_MODELS) {
    assert.equal(modelsForHuggingFaceLink(model.url)[0].id,model.id);
    assert.equal(modelsForHuggingFaceLink(model.url.replace('/resolve/', '/blob/').replace(model.revision,'main')+'?download=true')[0].id,model.id);
  }
  for (const link of ['https://huggingface.co.evil.test/a/b', 'http://huggingface.co/a/b', 'https://user@huggingface.co/a/b', repo+'/resolve/main/unverified.gguf', repo+'/tree/unverified', 'https://example.com/model.gguf']) assert.throws(()=>modelsForHuggingFaceLink(link),link);
});
