import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  chatMessages,
  clearChatHistory,
  createChat,
  deleteChat,
  exportChatHistory,
  getChat,
  importChatHistory,
  listChats,
  renameChat,
  saveChat,
} from "../src/utils/chatHistory";
import type { AiChatMessage } from "../src/types";

const messages = (count: number): AiChatMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `m-${i}`,
    role: i % 2 ? "assistant" : "user",
    content: `Message ${i}`,
    timestamp: 42,
    modelId: "lfm2.5-350m-q4-k-m",
    ...(i % 2 ? { route: "model" as const } : {}),
  }));
test("chat storage keeps exact order at identical timestamps and pages older messages", async () => {
  await clearChatHistory();
  const chat = await createChat("New conversation", "lfm2.5-350m-q4-k-m");
  await saveChat(chat.id, messages(450), {}, "lfm2.5-350m-q4-k-m");
  const recent = await chatMessages(chat.id);
  assert.equal(recent.length, 200);
  assert.equal(recent[0].content, "Message 250");
  const earlier = await chatMessages(chat.id, recent[0]);
  assert.equal(earlier[0].content, "Message 50");
  assert.equal(earlier.at(-1)?.content, "Message 249");
  assert.deepEqual(await chatMessages(chat.id,{id:recent[0].id}),earlier,'Newly sent messages can page by ID before their sequence is reloaded');
  await saveChat(chat.id, recent, {}, "qwen3.5-0.8b-q4-k-m");
  assert.equal((await chatMessages(chat.id, recent[0])).length, 200);
  assert.equal(
    (await getChat(chat.id))?.selectedModelId,
    "qwen3.5-0.8b-q4-k-m",
  );
  assert.equal((await getChat(chat.id))?.title, "Message 0");
});
test("search and rename operate on saved content; proposals cannot replay after reopening", async () => {
  await clearChatHistory();
  const chat = await createChat("New conversation", "lfm2.5-350m-q4-k-m");
  const message = {
    ...messages(1)[0],
    content: "Private dentist note",
    suggestedPlan: { kind: "delete" as const, events: [{title:'Dentist',startDate:'2026-10-25',startTime:'10:00'}], originals: [] },
  };
  await saveChat(
    chat.id,
    [message],
    { proposal: { command: {} as never, request: "private" } },
    "lfm2.5-350m-q4-k-m",
  );
  await renameChat(chat.id, "Health");
  assert.equal((await listChats("dentist"))[0].title, "Health");
  assert.equal((await chatMessages(chat.id))[0].suggestedPlan, undefined);
  assert.match((await chatMessages(chat.id))[0].proposalSummary!,/Dentist.*2026-10-25.*10:00/u);
  await saveChat(chat.id,[{...message,suggestedPlan:undefined}],{},'lfm2.5-350m-q4-k-m');
  assert.match((await chatMessages(chat.id))[0].proposalSummary!,/Dentist/u);
  assert.equal((await getChat(chat.id))?.context?.proposal, undefined);
  await deleteChat(chat.id);
  await saveChat(chat.id, [message], {}, "lfm2.5-350m-q4-k-m");
  assert.equal(
    await getChat(chat.id),
    undefined,
    "Late saves cannot resurrect deleted conversations",
  );
});
test("history backup imports with fresh IDs and validates the whole file before any write", async () => {
  await clearChatHistory();
  const chat = await createChat("New conversation", "lfm2.5-350m-q4-k-m");
  await saveChat(chat.id, messages(4), {}, "lfm2.5-350m-q4-k-m");
  const backup = await exportChatHistory();
  await importChatHistory(JSON.stringify(backup));
  assert.equal((await listChats()).length, 2);
  const imported = (await listChats()).find((c) => c.id !== chat.id)!;
  assert.deepEqual(
    (await chatMessages(imported.id)).map((m) => m.content),
    messages(4).map((m) => m.content),
  );
  const before = await exportChatHistory();
  const broken = structuredClone(backup);
  broken.messages[0].role = "intruder";
  await assert.rejects(importChatHistory(JSON.stringify(broken)));
  assert.deepEqual(await exportChatHistory(), before);
});
