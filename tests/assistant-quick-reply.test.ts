import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantQuickReply } from '../src/utils/assistantQuickReply';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { modelStatus } from '../src/utils/localModelRuntime';
import { calendarSystemPrompt } from '../src/utils/modelCommand';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { event } from './fixtures';
const now = new Date(2026, 9, 21, 10);
test('greetings and clarification never load the model or create calendar proposals', async () => {
  const history = { turns: [{ role: 'assistant' as const, content: '{"action":"delete","query":"Dentysta"}' }] };
  for (const [language, greeting, question] of [['pl', 'Cześć!', 'Co?'], ['en', 'Hello', 'What?'], ['ru', 'Привет', 'Что?'], ['de', 'Hallo', 'Was?']] as const) {
    for (const message of [greeting, question]) {
      const result = await runModelAssistant(message, [], language, now, history, DEFAULT_PLANNING);
      assert.ok(result.text.length > 30);
      assert.equal(result.suggestedPlan, undefined);
      assert.equal(result.suggestedEvent, undefined);
      assert.equal(result.context, history);
      assert.equal(modelStatus().phase, 'checking', 'No weights or engine may be loaded for social messages');
    }
    assert.equal(await assistantQuickReply(`${greeting} Add event Dentist tomorrow at 15:00`, [], language, now, DEFAULT_PLANNING), undefined);
  }
});
test('exact built-in conflict shortcuts use calendar calculations without proposing mutations', async () => {
  const events = [event({ title: 'A', startDate: '2026-10-21', endDate: '2026-10-21', startTime: '10:00', endTime: '11:00' }), event({ id: 'B', title: 'B', startDate: '2026-10-21', endDate: '2026-10-21', startTime: '10:30', endTime: '11:30' })];
  const result = await assistantQuickReply('Sprawdź kolizje terminów', events, 'pl', now, DEFAULT_PLANNING);
  assert.match(result!.text, /Kolizje/);
  assert.equal(result?.suggestedPlan, undefined);
  assert.equal(await assistantQuickReply('Sprawdź kolizje i usuń wydarzenia', events, 'pl', now, DEFAULT_PLANNING), undefined);
});
test('calendar system prefix stays stable across minutes and changes on a new day', () => {
  const later = new Date(now.getTime() + 120000);
  assert.equal(calendarSystemPrompt('pl', now), calendarSystemPrompt('pl', later));
  assert.notEqual(calendarSystemPrompt('pl', now), calendarSystemPrompt('pl', new Date(2026, 9, 22, 10)));
});
