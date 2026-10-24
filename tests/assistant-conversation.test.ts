import test from "node:test";
import assert from "node:assert/strict";
import { runModelAssistant } from "../src/utils/modelAssistant";
import {
  parseModelCommand,
  resolveModelCommand,
  COMMAND_SCHEMA,
  ASSISTANT_SCHEMA,
} from "../src/utils/modelCommand";
import { DEFAULT_PLANNING } from "../src/utils/assistantPlanning";
import { diagnosticsReport } from "../src/utils/modelDiagnostics";
import { event } from "./fixtures";
import { needsCalendarExtraction } from '../src/utils/assistantRoute';
import { guardCalendarWriteClaim } from '../src/utils/calendarWriteClaim';
const now = new Date(2026, 9, 24, 10);
test('a generated saved claim cannot stand in for explicit calendar confirmation',async()=>{
  for(const text of ['Changes saved.', 'I have added the event.', 'Zapisano zmiany.', 'Изменения сохранены.', 'Änderungen gespeichert.'])assert.notEqual(guardCalendarWriteClaim(text,'en'),text);
  for(const text of ['No changes were saved.', 'I have not saved an event.', 'Please confirm to save the event.'])assert.equal(guardCalendarWriteClaim(text,'en'),text);
  const result=await resolveModelCommand(parseModelCommand('{"action":"chat","reply":"Changes saved."}'),'Hi',[],'en',now,DEFAULT_PLANNING);
  assert.match(result.text,/No calendar changes/u);assert.equal(result.suggestedPlan,undefined);
});
test('ordinary chat does not inherit calendar intent from a pending draft or pronouns', () => {
  const context = {pending:{command:parseModelCommand('{"action":"create","title":"Yoga"}'),request:'Add Yoga'},reference:{title:'Yoga',date:'2026-10-25'}};
  for (const query of ['Cześć co tam?', 'Maybe it will be better in english', 'So speak english', 'I had a rough day today', 'I think it will help me tomorrow', 'Jak się dzisiaj czujesz?']) assert.equal(needsCalendarExtraction(query,now,context),false,query);
  for (const query of ['tomorrow at 14:00', 'Move it to Friday', 'What is on tomorrow?', 'Czy mam wolne jutro?', 'Change its duration to 30 minutes']) assert.equal(needsCalendarExtraction(query,now,context),true,query);
  assert.equal(needsCalendarExtraction('Что у меня завтра?',now,{},'ru'),true);
  assert.equal(needsCalendarExtraction('Was steht morgen an?',now,{},'de'),true);
});
test('a time typo asks about time while retaining the named event draft',async()=>{
  const first=await runModelAssistant('Add new event called studying tomorrow at 4-5 pk',[],'pl',now,{},DEFAULT_PLANNING);
  assert.equal(first.route,'rules');assert.equal(first.suggestedPlan,undefined);
  assert.match(first.text,/studying.*2026-10-25/u);assert.match(first.text,/Which time/u);assert.doesNotMatch(first.text,/another name/u);
  assert.equal(first.context.pending?.command.title,'studying');
  const next=await runModelAssistant('pm',[],'pl',now,first.context,DEFAULT_PLANNING);
  assert.equal(next.suggestedPlan?.events[0].title,'studying');assert.equal(next.suggestedPlan?.events[0].startTime,'16:00');assert.equal(next.suggestedPlan?.events[0].endTime,'17:00');
});
test("chat command replies pass through the resolver without calendar mutation proposals", async () => {
  const command = parseModelCommand(
    JSON.stringify({ action: "chat", reply: "Conversation reply fixture" }),
  );
  const response = await resolveModelCommand(
    command,
    "Can we talk?",
    [],
    "en",
    now,
    DEFAULT_PLANNING,
  );
  assert.equal(response.text, command.reply);
  assert.equal(response.suggestedPlan, undefined);
  assert.ok(!COMMAND_SCHEMA.properties.action.enum.includes("chat" as never));
  assert.ok(ASSISTANT_SCHEMA.properties.action.enum.includes("chat"));
});
test("a confirmed event reference resolves a pronoun through existing calendar tools", async () => {
  const original = event({
    title: "Yoga",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
  });
  const response = await runModelAssistant(
    "Przenieś go na 2026-10-26 o 14:00",
    [original],
    "en",
    now,
    { reference: { title: "Yoga", date: "2026-10-25" } },
    DEFAULT_PLANNING,
  );
  assert.equal(response.route, "rules");
  assert.equal(response.suggestedPlan?.kind, "move");
  assert.equal(response.suggestedPlan?.events[0].startDate, "2026-10-26");
  assert.equal(original.startDate, "2026-10-25");
});
test("editing an unconfirmed proposal stays a create proposal and never targets a saved event", async () => {
  const first = await runModelAssistant(
    "Dodaj wydarzenie Yoga jutro o 9:00",
    [],
    "en",
    now,
    {},
    DEFAULT_PLANNING,
  );
  const moved = await runModelAssistant(
    "Przenieś go na 2026-10-26 o 14:00",
    [],
    "en",
    now,
    first.context,
    DEFAULT_PLANNING,
  );
  assert.equal(moved.suggestedPlan?.kind, "create");
  assert.equal(moved.suggestedPlan?.originals.length, 0);
  assert.equal(moved.suggestedPlan?.events[0].startTime, "14:00");
});
test("diagnostics do not encode or retain private message content", async () => {
  await runModelAssistant(
    "Dodaj wydarzenie PoufnaRozmowa jutro o 9:00",
    [],
    "en",
    now,
    {},
    DEFAULT_PLANNING,
  );
  const report = JSON.stringify(diagnosticsReport());
  assert.ok(!report.includes("PoufnaRozmowa"));
  assert.ok(!report.includes("nonAsciiCodePoints"));
});
test('a model cannot substitute a different existing event for a requested deletion',async()=>{
  const command=parseModelCommand(JSON.stringify({action:'delete',query:'Lunch'}));
  const response=await resolveModelCommand(command,'Delete Yoga',[event({title:'Lunch'})],'en',now,DEFAULT_PLANNING);
  assert.equal(response.suggestedPlan,undefined);assert.match(response.text,/not identified/u);
});
