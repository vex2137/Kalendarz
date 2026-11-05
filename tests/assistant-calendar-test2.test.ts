import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFields, parseCalendarCommand } from '../src/utils/calendarCommandParser';
import { parseModelCommand, resolveModelCommand } from '../src/utils/modelCommand';
import { needsCalendarExtraction } from '../src/utils/assistantRoute';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { diagnosticsReport } from '../src/utils/modelDiagnostics';
import { requestedReminderMinutes } from '../src/utils/calendarReminder';

const now = new Date(2026, 10, 5, 10, 0); // Thursday, local phone calendar.
const resolve = (request: string, command: object, at = now) =>
  resolveModelCommand(parseModelCommand(JSON.stringify(command)), request, [], 'pl', at, DEFAULT_PLANNING);

test('a correct Qwen JSON is accepted for the exact reported request', async () => {
  const request = 'Utwórz wydarzenie o nazwie Test jutro o godzinie 15:00, czas trwania 1 godzina.';
  const result = await resolve(request, { action:'create', title:'Test', date:'2026-11-06', time:'15:00', endTime:'16:00' });
  assert.equal(result.suggestedPlan?.events[0].title, 'Test');
  assert.equal(result.suggestedPlan?.events[0].startTime, '15:00');
  assert.equal(result.suggestedPlan?.events[0].endTime, '16:00');
});

test('the requested Polish calendar regressions preserve fields without saving', async () => {
  for (const [request,title,date,time,endTime] of [
    ['Utwórz wydarzenie o nazwie Test jutro o 15:00 na godzinę','Test','2026-11-06','15:00','16:00'],
    ['Dodaj matematykę w piątek o 8:00','matematykę','2026-11-06','08:00','09:00'],
    ['Przypomnij mi o sprawdzianie jutro o 12:00','sprawdzianie','2026-11-06','12:00','13:00'],
    ['Zaplanuj trening dzisiaj od 18:00 do 19:30','trening','2026-11-05','18:00','19:30'],
  ]) {
    assert.equal(needsCalendarExtraction(request, now, {}, 'pl'), true, request);
    const result = await resolve(request, {action:'create',title,date,time,endTime});
    const event = result.suggestedPlan?.events[0];
    assert.ok(event, request + ': ' + result.text);
    assert.deepEqual([event.title,event.startDate,event.startTime,event.endTime], [title,date,time,endTime]);
    assert.equal(result.suggestedPlan?.kind, 'create');
    assert.deepEqual(result.suggestedPlan.originals, []);
    if (request.startsWith('Przypomnij')) assert.deepEqual(event.reminders, [0]);
    const application=await runModelAssistant(request,[],'pl',now,{},DEFAULT_PLANNING);
    assert.equal(application.suggestedPlan?.events[0].title,title,request);
    assert.equal(application.suggestedPlan?.events[0].endTime,endTime,request);
  }
});

test('labelled durations, dotted clocks and midnight use explicit local evidence', async () => {
  const fields = calendarFields('Test jutro o godzinie 23.30, czas trwania: 2 godziny', now);
  assert.equal(fields.invalid, false);
  assert.equal(fields.time, '23:30');
  assert.equal(fields.duration, 120);
  assert.equal(fields.endTime, '01:30');
  assert.equal(fields.endDate, '2026-11-07');
  assert.equal(fields.rest, 'Test');
  const localMidnight = new Date('2026-11-05T23:30:00Z'); // Nov 6 in Europe/Warsaw.
  assert.equal(calendarFields('jutro o godzinie 15:00', localMidnight).date, '2026-11-07');
  assert.equal(calendarFields('jutro o godzinie 25:00', now).invalid, true);
  assert.equal(calendarFields('jutro o 15:00 do 16:00, czas trwania 2 godziny', now).invalid, true);
});

test('missing date or title is never filled from examples or the model', async () => {
  for (const [request,command] of [
    ['Utwórz wydarzenie o nazwie Test o godzinie 15:00', {action:'create',title:'Test',date:'2026-11-05',time:'15:00'}],
    ['Utwórz wydarzenie jutro o godzinie 15:00', {action:'create',title:'Dentysta',date:'2026-11-06',time:'15:00'}],
    ['Utwórz wydarzenie jutro o godzinie 15:00', {action:'create',date:'2026-11-06',time:'15:00'}],
  ] as const) assert.equal((await resolve(request,command)).suggestedPlan, undefined, request);
  assert.equal(parseCalendarCommand('Utwórz wydarzenie o nazwie Test o godzinie 15:00','pl',now)?.incomplete,true);
});

test('ordinary questions keep the natural conversation route', () => {
  for (const query of ['Co to jest fotosynteza?', 'Jak się dzisiaj czujesz?', 'Przypomnij mi, czym jest fotosynteza.'])
    assert.equal(needsCalendarExtraction(query,now,{},'pl'),false,query);
  assert.equal(requestedReminderMinutes('Dodaj Test jutro o 12:00 z przypomnieniem'),undefined);
  assert.equal(requestedReminderMinutes('Przypomnij mi o Test 10 minut przed'),10);
  assert.equal(requestedReminderMinutes('Przypomnij mi o Test przed spotkaniem'),undefined);
  assert.equal(parseCalendarCommand('Zaplanuj trzy treningi jutro od 18:00 do 19:30','pl',now),undefined);
  assert.equal(parseCalendarCommand('Zaplanuj mój tydzień','pl',now),undefined);
});

test('invalid model JSON is distinct from a valid but incomplete command without logging text', () => {
  const diagnostic: {modelJsonValid?:boolean;modelResponseCharacters?:number} = {};
  assert.throws(()=>parseModelCommand('PRIVATE_RAW_RESPONSE',diagnostic));
  assert.deepEqual(diagnostic,{modelJsonValid:false,modelResponseCharacters:20});
  const command=parseModelCommand('{"action":"create"}',diagnostic);
  assert.equal(diagnostic.modelJsonValid,true);
  assert.equal(command.title,null);
  assert.equal(command.date,null);
  assert.equal(command.time,null);
  assert.ok(!JSON.stringify(diagnostic).includes('PRIVATE_RAW_RESPONSE'));
});

test('diagnostics contain field presence instead of private input or generated JSON', async () => {
  const request='Utwórz wydarzenie o nazwie PRIVATE_TEST2_TITLE jutro o godzinie 15:00, czas trwania 2 godziny';
  const result=await runModelAssistant(request,[],'pl',now,{},DEFAULT_PLANNING);
  assert.equal(result.suggestedPlan?.events[0].endTime,'17:00');
  const trace=diagnosticsReport().turns.at(-1)!;
  assert.equal(trace.route,'rules');
  assert.deepEqual(trace.requestFields,{date:true,time:true,duration:true,invalid:false});
  assert.equal(trace.commandFields?.title,true);
  assert.equal(trace.proposalPrepared,true);
  assert.ok(!JSON.stringify(diagnosticsReport()).includes('PRIVATE_TEST2_TITLE'));
});
