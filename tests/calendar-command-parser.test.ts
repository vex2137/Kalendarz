import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calendarFields, parseCalendarCommand } from '../src/utils/calendarCommandParser';
import { resolveModelCommand } from '../src/utils/modelCommand';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { event } from './fixtures';

const now = new Date('2026-10-23T08:00:00Z');
const events = [event({ id: 'dentist', title: 'Dentysta', startDate: '2026-10-26', endDate: '2026-10-26', startTime: '15:00', endTime: '16:30' }), event({ id: 'yoga', title: 'Joga', startDate: '2026-10-27', endDate: '2026-10-27', startTime: '18:00', endTime: '19:00' })];
const cases = JSON.parse(readFileSync(new URL('./fixtures/assistant-evaluation.json', import.meta.url), 'utf8'));
test('paired evaluation checks complete proposals, constraints, read-only results and pending drafts', async () => {
  const failures: string[] = [];
  for (const language of ['pl', 'en'] as const) {
    let routed = 0;
    for (const item of cases) {
      let parsed, pending;
      for (const request of item[language]) {
        parsed = parseCalendarCommand(request, language, now, pending);
        if (parsed?.incomplete) pending = { command: parsed.command, request: parsed.request };
      }
      if (Number(item.id.slice(1)) <= 59) assert.ok(parsed, `${language}/${item.id}: explicit simple requests must use rules`);
      if (!parsed) continue; // Real GGUF evaluation independently scores unrouted cases.
      routed++;
      try {
        const result = await resolveModelCommand(parsed.command, parsed.request, events, language, now, DEFAULT_PLANNING);
        if (item.expected.kind) {
          assert.equal(result.suggestedPlan?.kind, item.expected.kind);
          assert.equal(result.suggestedPlan?.events.length, 1);
          for (const [key, value] of Object.entries(item.expected.event || {})) assert.equal(result.suggestedPlan?.events[0]?.[key as keyof ReturnType<typeof event>], value, key);
          if (item.expected.id) assert.equal(result.suggestedPlan?.originals[0]?.id, item.expected.id);
        } else {
          assert.equal(result.suggestedPlan, undefined);
          for (const text of item.expected.contains || []) assert.ok(result.text.includes(text), text);
          if (item.expected.clarify) assert.match(result.text, /podaj|doprecyz|specify|clarif|which|please provide/iu);
        }
      } catch (error) { failures.push(`${language}/${item.id}: ${String(error)}`); }
    }
    assert.equal(routed, 59, `${language}: rule/model boundary changed`);
  }
  assert.deepEqual(failures, []);
});

test('ambiguous, negated, recurring and constrained commands retain real model extraction', () => {
  for (const query of ['Nie usuwaj dentysty', 'Delete Joga except next week', 'Dodaj kurs co tydzień jutro o 15', 'Add meeting tomorrow after 15', 'Dodaj kurs jutro przed 12', 'Dodaj Kurs jutro o 25:00', 'Dodaj Kurs jutro o 10:99', 'Dodaj Kurs jutro o 0 pm', 'Dodaj Kurs jutro pojutrze o 12', 'Dodaj Kurs 2026-02-30 o 15', 'Dodaj Kurs jutro o 12 z przypomnieniem 10 minut wcześniej']) assert.equal(parseCalendarCommand(query, 'pl', now), undefined, query);
  for (const query of ['Dodaj Kurs jutro o 12 bez kolizji', 'Add Review tomorrow at 12 with a reminder', 'Dodaj Kurs jutro o 12 z Anią']) assert.equal(parseCalendarCommand(query, 'pl', now), undefined, query);
  assert.equal(parseCalendarCommand('Dodaj Kurs jutro o 12', 'de', now), undefined);
});

test('missing dates and times are never invented; quoted words and midnight remain literal', () => {
  assert.equal(parseCalendarCommand('Dodaj „Jutro o 12”', 'pl', now)?.command.date, null);
  assert.equal(calendarFields('jutro o 23:50 na pół godziny', now).endDate, '2026-10-25');
  assert.equal(calendarFields('jutro o 12 am', now).time, '00:00');
  assert.equal(calendarFields('w piątek', now).date, '2026-10-23');
  assert.equal(calendarFields('w przyszły piątek', now).date, '2026-10-30');
  assert.equal(parseCalendarCommand('Dodaj 🦷 Kontrola jutro o 10', 'pl', now)?.command.title, '🦷 Kontrola');
});

test('date arithmetic crosses Warsaw DST, month and year as calendar days', () => {
  for (const [instant, expected] of [['2026-10-24T21:30:00Z', '2026-10-25'], ['2026-10-31T22:30:00Z', '2026-11-01'], ['2026-12-31T12:00:00Z', '2027-01-01']]) assert.equal(calendarFields('jutro', new Date(instant)).date, expected);
});
test('duration changes use the existing start and calendar arithmetic rather than a guessed model end', async () => {
  const parsed = parseCalendarCommand('Przenieś dentystę na jutro na 30min', 'pl', now)!;
  const result = await resolveModelCommand(parsed.command, parsed.request, events, 'pl', now, DEFAULT_PLANNING);
  assert.equal(result.suggestedPlan?.events[0].startTime, '15:00');
  assert.equal(result.suggestedPlan?.events[0].endTime, '15:30');
});
test('sentence punctuation and negation inside explicit description data do not change the intent', async () => {
  for (const request of ['Dodaj Przegląd jutro o 10.', 'Dodaj Przegląd jutro o 10, opis: nie zapomnij dokumentów']) {
    const parsed = parseCalendarCommand(request, 'pl', now)!;
    assert.equal(parsed.command.title, 'Przegląd');
    const result = await resolveModelCommand(parsed.command, parsed.request, events, 'pl', now, DEFAULT_PLANNING);
    assert.equal(result.suggestedPlan?.kind, 'create');
    if (request.includes('opis:')) assert.equal(result.suggestedPlan?.events[0].description, 'nie zapomnij dokumentów');
  }
});
test('polite infinitives keep action identity across create, move, delete and search', () => {
  for (const [query, action] of [['Czy mógłbyś wpisać Rezerwacja jutro o 11?', 'create'], ['Możesz przenieść Jogę na jutro?', 'update'], ['Proszę usunąć Jogę', 'delete'], ['Czy możesz znaleźć dentystę?', 'search']]) assert.equal(parseCalendarCommand(query, 'pl', now)?.command.action, action, query);
});
test('explicit PL/EN intervals survive proposal validation, including midnight', async () => {
  for (const [query, language, start, end, endDate] of [
    ['Add new event workout for today at 18-20 time', 'en', '18:00', '20:00', '2026-10-23'],
    ['Dodaj trening dzisiaj o 18 - 20', 'pl', '18:00', '20:00', '2026-10-23'],
    ['Add workout today from 18:15 – 20:45', 'en', '18:15', '20:45', '2026-10-23'],
    ['Dodaj trening dzisiaj od 18:30 do 20:15', 'pl', '18:30', '20:15', '2026-10-23'],
    ['Add workout today at 6-8 pm', 'en', '18:00', '20:00', '2026-10-23'],
    ['Add workout today at 11 pm - 1 am', 'en', '23:00', '01:00', '2026-10-24'],
    ['Dodaj trening dzisiaj o 23–1', 'pl', '23:00', '01:00', '2026-10-24'],
  ] as const) {
    const parsed = parseCalendarCommand(query, language, now);
    assert.ok(parsed, query);
    const result = await resolveModelCommand(parsed.command, query, [], language, now, DEFAULT_PLANNING);
    const proposal = result.suggestedPlan?.events[0];
    assert.equal(proposal?.startTime, start, query); assert.equal(proposal?.endTime, end, query); assert.equal(proposal?.endDate, endDate, query);
    assert.doesNotMatch(proposal?.title || '', /new event|18|20|time/u);
  }
  const request = 'Add workout today at 18-20';
  const parsed = parseCalendarCommand(request, 'en', now)!;
  const repaired = await resolveModelCommand({...parsed.command,endTime:'19:00'}, request, [], 'en', now, DEFAULT_PLANNING);
  assert.equal(repaired.suggestedPlan?.events[0].endTime, '20:00');
  for (const query of ['today at 25-27', 'today at 18-18', 'today at 18-20 for 30 minutes']) assert.equal(calendarFields(query, now).invalid, true, query);
});
test('named event titles and dates survive an uncertain clock suffix until clarified', async () => {
  for(const [query,language,title] of [
    ['Add new event called studying tomorrow at 4-5 pk','en','studying'],
    ['Create event named Reading tomorrow at 4-5 pn','en','Reading'],
    ['Dodaj wydarzenie o nazwie Nauka jutro o 4-5 pk','pl','Nauka'],
    ['Dodaj wydarzenie pod tytułem Nauka jutro o 4 pk','pl','Nauka'],
  ] as const){
    const parsed=parseCalendarCommand(query,language,now)!;
    assert.ok(parsed,query);assert.equal(parsed.command.title,title);assert.equal(parsed.command.date,'2026-10-24');
    assert.equal(parsed.command.time,null);assert.equal(parsed.incomplete,true);assert.ok(parsed.unresolvedTime);
    const corrected=parseCalendarCommand('pm',language,now,parsed)!;
    assert.equal(corrected.command.title,title);assert.equal(corrected.command.time,'16:00');
    const result=await resolveModelCommand(corrected.command,corrected.request,[],language,now,DEFAULT_PLANNING);
    assert.equal(result.suggestedPlan?.events[0].title,title);assert.equal(result.suggestedPlan?.events[0].startTime,'16:00');
    assert.equal(result.suggestedPlan?.events[0].endTime,'17:00');
    const changed=parseCalendarCommand('Actually today at 18-20',language,now,parsed)!;
    assert.equal(changed.command.date,'2026-10-23');
    const revised=await resolveModelCommand(changed.command,changed.request,[],language,now,DEFAULT_PLANNING);
    assert.equal(revised.suggestedPlan?.events[0].startDate,'2026-10-23');assert.equal(revised.suggestedPlan?.events[0].endTime,'20:00');
  }
});
