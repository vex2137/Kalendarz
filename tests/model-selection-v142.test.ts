import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeModel, DEFAULT_MODEL, findModel, persistModelSelection, OPTIONAL_FALLBACK, registerImportedModel } from '../src/utils/modelRegistry';
import { createChat, saveChat, getChat, chatMessages } from '../src/utils/chatHistory';

const selection = 'calendar_active_ai_model_v1';
const migration = 'calendar_default_model_migration_v142';
const oldDefault = 'qwen3.5-0.8b-q4-k-m';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
} });

test('new installations use private Qwen v2; the old default migrates once', () => {
  values.clear();
  assert.equal(activeModel().id, 'kalendarz-qwen35-v2-q4-k-m');
  assert.equal(DEFAULT_MODEL.url, '');
  values.clear(); values.set(selection, oldDefault);
  assert.equal(activeModel().id, DEFAULT_MODEL.id);
  assert.equal(values.get(selection), DEFAULT_MODEL.id);
  assert.equal(values.get(migration), DEFAULT_MODEL.id);
  assert.equal(findModel(oldDefault).id, oldDefault, 'History retains the actual original model descriptor');
  persistModelSelection(findModel(oldDefault));
  assert.equal(activeModel().id, oldDefault, 'An explicit later choice of the base model is respected');
});

test('migration preserves optional, imported and temporarily unavailable model selections', () => {
  const imported = { ...DEFAULT_MODEL, id: 'imported-' + 'a'.repeat(64), sha256: 'a'.repeat(64),
    bytes: 128, bundled: false, imported: true };
  registerImportedModel(imported);
  for (const id of [OPTIONAL_FALLBACK.id, imported.id, 'external-' + 'b'.repeat(32), 'future-model']) {
    values.clear(); values.set(selection, id);
    activeModel();
    assert.equal(values.get(selection), id);
  }
});

test('default migration leaves chat messages, selected model history and unrelated settings intact', async () => {
  values.clear(); values.set(selection, oldDefault);
  values.set('calendar_language', 'pl'); values.set('calendar_settings_fixture', '{"theme":"dark"}');
  const chat = await createChat('Retained conversation', oldDefault);
  const messages = [{ id: 'retained', role: 'user' as const, content: 'Dentysta jutro o 10', timestamp: 1 }];
  await saveChat(chat.id, messages, {}, oldDefault);
  const savedMessages = await chatMessages(chat.id);
  const previous = new Map(values);
  activeModel();
  for (const [key, value] of previous) if (key !== selection) assert.equal(values.get(key), value);
  assert.equal((await getChat(chat.id))?.selectedModelId, oldDefault);
  assert.deepEqual(await chatMessages(chat.id), savedMessages);
});

test('read-only settings storage does not override an explicit optional choice', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => key === selection ? OPTIONAL_FALLBACK.id : null,
    setItem: () => { throw new Error('read-only'); },
  } });
  try { assert.equal(activeModel().id, OPTIONAL_FALLBACK.id); }
  finally { Object.defineProperty(globalThis, 'localStorage', original); }
});
