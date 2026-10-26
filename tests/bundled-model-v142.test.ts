import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL } from '../src/utils/modelRegistry';
import { installLocalModel, modelStatus } from '../src/utils/localModelRuntime';

test('installing the bundled Qwen v2 adopts APK assets without downloading weights', async () => {
  const beforeDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const beforeFetch = globalThis.fetch;
  const requests: string[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { baseURI: 'https://localhost/index.html' } });
  globalThis.fetch = async input => {
    requests.push(String(input));
    assert.equal(String(input), 'https://localhost/models/manifest.json', 'Only bundled metadata is requested');
    return new Response(JSON.stringify({ file: DEFAULT_MODEL.file, bytes: DEFAULT_MODEL.bytes, sha256: DEFAULT_MODEL.sha256 }));
  };
  try {
    await installLocalModel();
    assert.equal(modelStatus().installed, true);
    assert.equal(modelStatus().modelId, 'kalendarz-qwen35-v2-q4-k-m');
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = beforeFetch;
    if (beforeDocument) Object.defineProperty(globalThis, 'document', beforeDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
