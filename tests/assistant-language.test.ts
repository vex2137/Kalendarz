import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAssistantLanguage } from '../src/utils/assistantLanguage';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { assistantTurns } from '../src/utils/modelDiagnostics';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';

const now = new Date(2026, 9, 23, 10);
test('natural language switch requests override conversation and interface language', () => {
  for (const fallback of ['pl','en','de','ru'] as const) {
    for (const query of ['Maybe it will be better in english', 'So speak english', 'Can we continue in English please?', 'Please talk to me in English']) assert.equal(detectAssistantLanguage(query, fallback),'en',query);
    assert.equal(detectAssistantLanguage('Could you speak Polish please?',fallback),'pl');
  }
});
test('message language wins over each UI language, including decomposed Android input', async () => {
  for (const ui of ['en', 'pl', 'de', 'ru'] as const) {
    for (const [message, language, reply] of [
      ['Cześć', 'pl', /^Cześć!/u], ['Cześć'.normalize('NFD'), 'pl', /^Cześć!/u],
      ['Cześć\u200b!', 'pl', /^Cześć!/u], ['Dzień dobry', 'pl', /^Cześć!/u],
      ['Hello', 'en', /^Hello!/u], ['Привет', 'ru', /^Привет!/u], ['Hallo', 'de', /^Hallo!/u],
      ['Dobra', 'pl', /^Nie ma za co!/u], ['Хорошо', 'ru', /^Пожалуйста!/u],
    ] as const) {
      const response = await runModelAssistant(message, [], ui, now, {}, DEFAULT_PLANNING);
      assert.equal(response.route, 'quick', `${ui}: ${message}`);
      assert.equal(response.language, language);
      assert.match(response.text, reply);
      assert.equal(response.suggestedPlan, undefined);
      const trace = assistantTurns().at(-1)!;
      assert.equal(trace.uiLanguage, ui);
      assert.equal(trace.quickChecked, true);
      assert.equal(trace.quickMatched, true);
      assert.equal(trace.route, 'quick');
    }
  }
});
test('localized built-in schedule shortcuts keep their own response language', async () => {
  for (const ui of ['en', 'pl', 'de', 'ru'] as const) {
    for (const [message, expected] of [['Mój plan', 'pl'], ['мой план', 'ru'], ['my schedule today', 'en'], ['mein plan heute', 'de']] as const) {
      const response = await runModelAssistant(message, [], ui, now, {}, DEFAULT_PLANNING);
      assert.equal(response.route, 'quick'); assert.equal(response.language, expected);
    }
  }
});
test('Polish/English calendar rules and response language are independent of the UI', async () => {
  for (const ui of ['en', 'pl', 'de', 'ru'] as const) {
    const pl = await runModelAssistant('Dodaj wydarzenie Kontrola jutro o 15:00', [], ui, now, {}, DEFAULT_PLANNING);
    assert.equal(pl.route, 'rules'); assert.equal(pl.language, 'pl');
    assert.match(pl.text, /^Sprawdź/u);
    assert.deepEqual([pl.suggestedPlan?.events[0].title, pl.suggestedPlan?.events[0].startDate, pl.suggestedPlan?.events[0].startTime], ['Kontrola', '2026-10-24', '15:00']);
    const en = await runModelAssistant('Add event Checkup tomorrow at 15:00', [], ui, now, pl.context, DEFAULT_PLANNING);
    assert.equal(en.route, 'rules'); assert.equal(en.language, 'en'); assert.match(en.text, /^Review/u);
    assert.equal(en.suggestedPlan?.events[0].title, 'Checkup');
  }
});
test('a numeric follow-up keeps message language; quoted names do not override it', async () => {
  const pending = await runModelAssistant('Dodaj wydarzenie Kontrola', [], 'en', now, {}, DEFAULT_PLANNING);
  const completed = await runModelAssistant('jutro o 15:00', [], 'en', now, pending.context, DEFAULT_PLANNING);
  assert.equal(completed.language, 'pl'); assert.equal(completed.suggestedPlan?.events[0].startTime, '15:00');
  assert.equal(detectAssistantLanguage('14:00', 'pl'), 'pl');
  assert.equal(detectAssistantLanguage('Add "Cześć jutro dodaj wydarzenie" tomorrow at 14:00', 'pl'), 'en');
  assert.equal(detectAssistantLanguage('найди событие завтра', 'en'), 'ru');
  assert.equal(detectAssistantLanguage('Lösche den Termin morgen', 'en'), 'de');
  assert.equal(detectAssistantLanguage('Możemy po prostu pogadać?', 'en'), 'pl');
  assert.equal(detectAssistantLanguage('Opowiedz krótki dowcip o zegarku.', 'en'), 'pl');
  assert.equal(detectAssistantLanguage('Can we just have a chat?', 'pl'), 'en');
  assert.equal(detectAssistantLanguage('W sumie powiedz po angielsku, co zmieniłeś.', 'pl'), 'en');
  assert.equal(detectAssistantLanguage('Now tell me in Polish what changed.', 'en'), 'pl');
});
