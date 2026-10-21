import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { COMMAND_SCHEMA, parseModelCommand, resolveModelCommand, type ModelCommand } from '../src/utils/modelCommand';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { changesForPlan } from '../src/utils/assistantChanges';
import { applyAssistantChanges } from '../src/utils/calendarStore';
import { verifyModel, savedModel } from '../src/utils/localModelStore';
import { event } from './fixtures';

const now = new Date(2026, 9, 21, 10);
const command = (patch: Partial<ModelCommand> = {}): ModelCommand => ({
  ...Object.fromEntries(COMMAND_SCHEMA.required.map(k => [k, null])), action: 'clarify', ...patch,
} as ModelCommand);
const resolve = (c: ModelCommand, request = '', events = [event()]) => resolveModelCommand(c, request, events, 'pl', now, DEFAULT_PLANNING);

// These are adapter/security tests using explicit data, not simulated model inference.
test('model output rejects unknown fields, actions, types and impossible dates/times', () => {
  for (const patch of [{ action: 'execute' }, { date: '2026-02-30' }, { time: '25:00' }, { time: '24:00' }, { allDay: 'true' }, { shell: 'rm' }, { recurrence: 'CUSTOM' }, { toString: 'injected' }]) {
    assert.throws(() => parseModelCommand(JSON.stringify(command(patch as never))));
  }
  assert.throws(() => parseModelCommand('{}'));
  assert.throws(() => parseModelCommand('```json\n{}\n```'));
  assert.equal(parseModelCommand(JSON.stringify(command({ action: 'create', date: '2028-02-29', time: '23:30' }))).date, '2028-02-29');
});
test('create uses existing validation, handles midnight and never writes until confirmed', async () => {
  const result = await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '23:30' }), 'Dodaj dentystę jutro o 23:30');
  assert.equal(result.suggestedPlan?.events[0].endDate, '2026-10-23');
  assert.equal(result.suggestedPlan?.events[0].endTime, '00:30');
  assert.equal(changesForPlan(result.suggestedPlan!)[0].after?.title, 'Dentysta');
  assert.equal((await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22' }))).suggestedPlan, undefined);
  assert.equal((await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-23', time: '10:00' }), 'Dodaj dentystę jutro o 10')).suggestedPlan, undefined);
  await assert.rejects(resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '13:00', endTime: '12:00' })));
});
test('edit preserves identity, reminders and original duration', async () => {
  const original = event({ title: 'Dentysta', reminders: [30], location: 'Gabinet' });
  const result = await resolve(command({ action: 'update', query: 'Dentysta', date: '2026-10-24', time: '14:00', title: 'Kontrola' }), '', [original]);
  const change = changesForPlan(result.suggestedPlan!)[0];
  assert.deepEqual(change.before, original);
  assert.equal(change.after?.id, original.id);
  assert.equal(change.after?.endTime, '15:00');
  assert.deepEqual(change.after?.reminders, [30]);
  assert.equal(change.after?.location, 'Gabinet');
});
test('deletion requires a unique non-recurring event and supports atomic undo', async () => {
  const created = await applyAssistantChanges([{ after: event({ title: 'Dentysta' }) }]);
  const original = created[0].before!;
  const result = await resolve(command({ action: 'delete', query: 'Dentysta' }), '', [original]);
  assert.equal(result.suggestedPlan?.kind, 'delete');
  const deletion = changesForPlan(result.suggestedPlan!);
  assert.deepEqual(deletion, [{ before: original }]);
  const inverse = await applyAssistantChanges(deletion);
  assert.equal(inverse[0].after?.title, original.title);
  await applyAssistantChanges(inverse);
  // Restored records have a new timestamp; a stale deletion must be rejected.
  await assert.rejects(applyAssistantChanges(deletion), /changed/);
  for (const candidates of [[original, event({ id: 'second', title: 'Dentysta' })], [event({ title: 'Dentysta', recurrence: 'WEEKLY' })], [event({ title: 'Dentysta', id: 'pl-holiday-test' })]]) {
    assert.equal((await resolve(command({ action: 'delete', query: 'Dentysta' }), '', candidates)).suggestedPlan, undefined);
  }
  assert.equal((await resolve(command({ action: 'delete', query: '' }))).suggestedPlan, undefined);
});
test('search returns calendar data without proposing a mutation', async () => {
  const result = await resolve(command({ action: 'search', query: 'Dentysta' }), '', [event({ title: 'Dentysta', location: 'Gabinet' })]);
  assert.match(result.text, /Dentysta/);
  assert.equal(result.suggestedPlan, undefined);
});
test('an invalid model file is rejected and cannot be mistaken for an installation', async () => {
  await assert.rejects(verifyModel(new Blob(['not a model'])), /model-size/);
  assert.equal(await savedModel(), undefined);
});
