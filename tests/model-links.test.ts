import test from 'node:test';
import assert from 'node:assert/strict';
import { modelsForHuggingFaceLink } from '../src/utils/modelLinks';
import { AI_MODELS, DEFAULT_MODEL, PREFERRED_MODEL, activeModel, shortModelName } from '../src/utils/modelRegistry';
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
test('Q4_K_M is preferred while explicit model and fallback choices retain their true quantization',()=>{
  assert.equal(PREFERRED_MODEL.id,'qwen3.5-0.8b-q4-k-m');assert.equal(PREFERRED_MODEL.quantization,'Q4_K_M');
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const selected=new Map();
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>selected.get(key)||null},configurable:true});
  try{
    assert.equal(activeModel().id,DEFAULT_MODEL.id,'Bundled fallback remains available before optional installation');
    for(const model of AI_MODELS){selected.set('calendar_active_ai_model_v1',model.id);assert.equal(activeModel().id,model.id);assert.equal(activeModel().quantization,model.quantization);assert.ok(!shortModelName(model).includes(model.quantization));}
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
});
