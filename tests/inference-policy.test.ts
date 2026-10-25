import test from 'node:test';
import assert from 'node:assert/strict';
import { completionTokenLimit } from '../src/utils/inferencePolicy';
import { modelErrorText } from '../src/utils/aiSettingsText';
test('short chat uses a bounded budget while extraction and explicit benchmarks retain their budgets',()=>{
  assert.equal(completionTokenLimit('qwen3.5-0.8b-q4-k-m','jak tam',false),96);
  assert.equal(completionTokenLimit('qwen3.5-0.8b-q4-k-m','Add dentist tomorrow',true),256);
  assert.equal(completionTokenLimit('lfm2.5-2.6b-q4-k-m','Add dentist tomorrow',true),768);
  assert.equal(completionTokenLimit('qwen','description of meeting',true),384);
  assert.equal(completionTokenLimit('qwen','hello',false,12),12);
});
test('missing URLs, access denial and invalid GGUF have separate actionable errors in every language',()=>{
  for(const lang of ['en','pl','de','ru'] as const){
    assert.match(modelErrorText('model-http-404',lang),/404/);
    assert.match(modelErrorText('model-http-403',lang),/403/);
    assert.notEqual(modelErrorText('model-gguf-invalid',lang),modelErrorText('model-gguf-unsupported',lang));
  }
});
