import { LOCAL_MODEL } from '../src/utils/localModelManifest';
import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { calendarSystemPrompt, commandSchemaForRequest, COMMAND_SCHEMA, parseModelCommand, resolveModelCommand, type ModelCommand } from '../src/utils/modelCommand';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { changesForPlan } from '../src/utils/assistantChanges';
import { applyAssistantChanges } from '../src/utils/calendarStore';
import { verifyModel, savedModel, bundledModelAvailable, loadBundledModel } from '../src/utils/localModelStore';
import { event } from './fixtures';

const now = new Date(2026, 9, 21, 10);
const command = (patch: Partial<ModelCommand> = {}): ModelCommand => ({
  ...Object.fromEntries(Object.keys(COMMAND_SCHEMA.properties).map(k => [k, null])), action: 'clarify', ...patch,
} as ModelCommand);
const resolve = (c: ModelCommand, request = '', events = [event()]) => resolveModelCommand(c, request, events, 'pl', now, DEFAULT_PLANNING);

test('clear command prefixes cannot generate a different mutation action', () => {
  for (const request of ['Add event Review on Friday', 'Dodaj przegląd w piątek', 'Добавь встречу завтра', 'Füge einen Termin hinzu']) {
    const allowed = commandSchemaForRequest(request).properties.action.enum;
    assert.ok(allowed.includes('create'));
    assert.ok(allowed.includes('clarify'));
    assert.ok(!allowed.includes('update') && !allowed.includes('delete'));
  }
  for (const request of ['Delete event Dentist', 'Usuń dentystę', 'Удали встречу', 'Lösche den Termin']) {
    assert.deepEqual(commandSchemaForRequest(request).properties.action.enum, ['delete', 'clarify']);
  }
  for (const request of ["Don't delete the dentist", 'Dodaj nie wydarzenie, tylko przypomnienie', 'Move dentist, but instead find it', 'Schedule three workouts next week']) {
    assert.equal(commandSchemaForRequest(request), COMMAND_SCHEMA);
  }
});

test('relative-date references use local calendar days across year and DST boundaries', () => {
  for (const [reference, today, tomorrow, dayAfter] of [
    [new Date(2026, 11, 31, 23, 30), '2026-12-31', '2027-01-01', '2027-01-02'],
    [new Date(2026, 9, 24, 23, 30), '2026-10-24', '2026-10-25', '2026-10-26'],
  ] as const) {
    const prompt = calendarSystemPrompt('pl', reference);
    assert.ok(prompt.includes(`dzisiaj/today = ${today}`));
    assert.ok(prompt.includes(`jutro/tomorrow = ${tomorrow}`));
    assert.ok(prompt.includes(`pojutrze/day after tomorrow = ${dayAfter}`));
  }
});

// These are adapter/security tests using explicit data, not simulated model inference.
test('model output rejects unknown fields, actions, types and impossible dates/times', () => {
  for (const patch of [{ action: 'execute' }, { date: '2026-02-30' }, { time: '25:00' }, { time: '24:00' }, { allDay: 'true' }, { shell: 'rm' }, { recurrence: 'CUSTOM' }, { toString: 'injected' }]) {
    assert.throws(() => parseModelCommand(JSON.stringify(command(patch as never))));
  }
  assert.throws(() => parseModelCommand('{}'));
  assert.throws(() => parseModelCommand('```json\n{}\n```'));
  assert.equal(parseModelCommand(JSON.stringify(command({ action: 'create', date: '2028-02-29', time: '23:30' }))).date, '2028-02-29');
});
test('blank nullable strings mean absent fields without accepting invalid dates or enums', () => {
  const result = parseModelCommand(JSON.stringify(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '15:00', endTime: '16:00', query: '', endDate: '', location: ' ', description: '', sourceDate: '', question: '' })));
  assert.equal(result.endDate, null);
  assert.equal(result.sourceDate, null);
  assert.equal(result.location, null);
  assert.equal(result.time, '15:00');
  for (const patch of [{ date: 'null' }, { endDate: '2026-02-30' }, { recurrence: '' }, { allDay: '' }]) {
    assert.throws(() => parseModelCommand(JSON.stringify(command(patch as never))));
  }
});
test('minimal model output defaults omitted optional fields without inventing event details', () => {
  const result = parseModelCommand('{"action":"create","title":"Dentysta","date":"2026-10-22","time":"15:00"}');
  assert.equal(result.endTime, null);
  assert.equal(result.allDay, null);
  assert.equal(result.recurrence, null);
  assert.equal(result.sourceDate, null);
  assert.equal(result.location, null);
});
test('create uses existing validation, handles midnight and never writes until confirmed', async () => {
  const result = await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '23:30' }), 'Dodaj dentystę jutro o 23:30');
  assert.equal(result.suggestedPlan?.events[0].endDate, '2026-10-23');
  assert.equal(result.suggestedPlan?.events[0].endTime, '00:30');
  assert.equal(changesForPlan(result.suggestedPlan!)[0].after?.title, 'Dentysta');
  assert.equal((await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22' }))).suggestedPlan, undefined);
  assert.equal((await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-23', time: '10:00' }), 'Dodaj dentystę jutro o 10')).suggestedPlan, undefined);
  await assert.rejects(resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '13:00', endTime: '12:00' }), 'Dodaj dentystę jutro od 13:00 do 12:00'));
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
test('invented all-day status, repetition, location and description never produce a proposal', async () => {
  const request = 'Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00';
  for (const patch of [{ allDay: true }, { recurrence: 'WEEKLY' }, { location: 'Oral Hygiene' }, { description: 'Annual checkup' }, { time: '05:00' }, { endTime: '17:00' }] as Partial<ModelCommand>[]) {
    const result = await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '15:00', endTime: '16:00', ...patch }), request);
    assert.equal(result.suggestedPlan, undefined);
  }
});
test('an unsolicited end time cannot change the default or the original duration', async () => {
  const moved = await resolve(command({ action: 'update', query: 'Dentysta', date: '2026-10-24', time: '14:00', endTime: '16:00' }), 'Przenieś wydarzenie Dentysta na 2026-10-24 o 14:00', [event({ title: 'Dentysta' })]);
  assert.equal(moved.suggestedPlan?.events[0].endTime, '15:00');
  const created = await resolve(command({ action: 'create', title: 'Dyżur', date: '2026-10-31', time: '23:30', endTime: '16:00' }), 'Dodaj wydarzenie Dyżur 2026-10-31 o 23:30');
  assert.equal(created.suggestedPlan?.events[0].endTime, '00:30');
  assert.equal(created.suggestedPlan?.events[0].endDate, '2026-11-01');
  const inventedDate = await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', endDate: '2026-10-24', time: '15:00', endTime: '16:00' }), 'Dodaj dentystę jutro o 15:00 do 16:00');
  assert.equal(inventedDate.suggestedPlan?.events[0].endDate, '2026-10-22');
  const range = await resolve(command({ action: 'create', title: 'Wyjazd', date: '2026-10-22', endDate: '2026-10-24', allDay: true }), 'Dodaj Wyjazd cały dzień od 2026-10-22 do 2026-10-24');
  assert.equal(range.suggestedPlan?.events[0].endDate, '2026-10-24');
});
test('generic query prefixes are removed only when the complete title has no match', async () => {
  const request = 'Usuń wydarzenie Dentysta';
  const result = await resolve(command({ action: 'delete', query: 'Wydarzenie Dentysta' }), request, [event({ title: 'Dentysta' })]);
  assert.equal(result.suggestedPlan?.kind, 'delete');
  const exact = event({ title: 'Event Horizon' });
  const other = event({ id: 'other', title: 'Horizon' });
  const selected = await resolve(command({ action: 'delete', query: 'Event Horizon' }), 'Delete Event Horizon', [exact, other]);
  assert.equal(selected.suggestedPlan?.originals[0].id, exact.id);
});
test('relative-date suffixes are removed from extracted titles but quoted titles stay intact', async () => {
  const fields = command({ action: 'create', title: 'Kontrola jutro', date: '2026-10-22', time: '09:00' });
  const plain = await resolve(fields, 'Dodaj wydarzenie Kontrola jutro o 09:00');
  assert.equal(plain.suggestedPlan?.events[0].title, 'Kontrola');
  const quoted = await resolve(fields, 'Dodaj wydarzenie „Kontrola jutro” jutro o 09:00');
  assert.equal(quoted.suggestedPlan?.events[0].title, 'Kontrola jutro');
});
test('explicit optional details are accepted in all application languages', async () => {
  for (const request of ['Dodaj Urlop jutro cały dzień co tydzień w Warszawie', 'Add Urlop tomorrow all day every week in Warszawie', 'Добавь Urlop завтра на весь день каждую неделю в Warszawie', 'Füge Urlop morgen ganztägig jede Woche in Warszawie hinzu']) {
    const result = await resolve(command({ action: 'create', title: 'Urlop', date: '2026-10-22', allDay: true, recurrence: 'WEEKLY', location: 'Warszawie' }), request);
    assert.ok(result.suggestedPlan, request);
  }
});
test('model examples and negated or hypothetical requests cannot silently become mutations', async () => {
  for (const request of ['Dodaj badanie krwi jutro o 10', 'Nie dodawaj dentysty jutro o 10', 'Gdybym dodał dentystę jutro o 10']) {
    assert.equal((await resolve(command({ action: 'create', title: 'Dentysta', date: '2026-10-22', time: '10:00' }), request)).suggestedPlan, undefined);
  }
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
test('a search for one day excludes later events but includes events spanning that day', async () => {
  const events = [
    event({ title: 'Dentysta', startDate: '2026-10-22', endDate: '2026-10-22' }),
    event({ id: 'later', title: 'Dentysta', startDate: '2026-10-23', endDate: '2026-10-23' }),
    event({ id: 'spanning', title: 'Dentysta nocny', startDate: '2026-10-21', endDate: '2026-10-22' }),
  ];
  const result = await resolve(command({ action: 'search', query: 'Dentysta', date: '2026-10-22' }), 'Znajdź dentystę jutro', events);
  assert.equal(result.text.split('\n').length, 2);
  assert.match(result.text, /Dentysta nocny/);
  assert.doesNotMatch(result.text, /2026-10-23/);
});
test('search ignores model date filters absent from the request', async () => {
  const result = await resolve(command({ action: 'search', query: 'Dentist', date: '2026-10-21', sourceDate: '2026-10-21' }), 'Find event Dentist', [event({ title: 'Dentist', startDate: '2026-10-24', endDate: '2026-10-24' })]);
  assert.match(result.text, /2026-10-24/);
});
test('an invalid model file is rejected and cannot be mistaken for an installation', async () => {
  await assert.rejects(verifyModel(new Blob(['not a model'])), /model-size/);
  assert.equal(await savedModel(), undefined);
});

test('bundled discovery requires pinned metadata and rejects wrong weight size', async () => {
  const documentBefore = globalThis.document, fetchBefore = globalThis.fetch;
  try {
    globalThis.document = { baseURI: 'https://localhost/index.html' } as Document;
    globalThis.fetch = async input => {
      assert.match(String(input), /^https:\/\/localhost\/models\//);
      return new Response(JSON.stringify({ file: LOCAL_MODEL.file, bytes: LOCAL_MODEL.bytes, sha256: LOCAL_MODEL.sha256 }));
    };
    assert.equal(await bundledModelAvailable(), true);
    globalThis.fetch = async () => new Response(JSON.stringify({ file: LOCAL_MODEL.file, bytes: LOCAL_MODEL.bytes, sha256: 'wrong' }));
    assert.equal(await bundledModelAvailable(), false);
    globalThis.fetch = async () => new Response('not weights');
    await assert.rejects(loadBundledModel(new AbortController().signal), /model-size/);
  } finally {
    globalThis.fetch = fetchBefore;
    if (documentBefore) globalThis.document = documentBefore; else Reflect.deleteProperty(globalThis, 'document');
  }
});
