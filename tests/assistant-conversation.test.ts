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
const now = new Date(2026, 9, 24, 10);
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
