import test from 'node:test';
import assert from 'node:assert/strict';
import { getTranslation, MONTH_NAMES, DAY_NAMES_SHORT, TRANSLATIONS, tr, translateRussian } from '../src/utils/i18n';
import { locale } from '../src/utils/dates';
import { runLocalAiAssistant, parseDateFromNaturalLanguage } from '../src/utils/aiEngine';
import { loadStoredSettings, saveStoredSettings } from '../src/utils/settingsStorage';
import { event, memoryStorage } from './fixtures';
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage() });
const now = new Date(2026, 9, 21, 8);

test('Russian has complete core UI copy, dates and persisted selection; English remains default', () => {
  for (const key of Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[]) {
    assert.ok(TRANSLATIONS.ru[key]);
    assert.notEqual(TRANSLATIONS.ru[key], TRANSLATIONS.en[key], key);
  }
  assert.equal(getTranslation('ru').appName, 'Календарь');
  assert.equal(MONTH_NAMES.ru[9], 'Октябрь');
  assert.equal(DAY_NAMES_SHORT.ru.length, 7);
  assert.equal(locale('ru'), 'ru-RU');
  assert.equal(loadStoredSettings().language, 'en');
  saveStoredSettings({ ...loadStoredSettings(), language: 'ru' });
  assert.equal(loadStoredSettings().language, 'ru');
});
test('Russian message templates preserve inserted user data and calendar dates', () => {
  const input = 'Which date should I move “Meet [Alex] $5” to?';
  assert.equal(translateRussian(input), 'На какой день перенести «Meet [Alex] $5»?');
  assert.equal(tr('ru', 'Pn', 'Mon'), 'Пн');
  assert.match(translateRussian('I prepared 3 drafts of 60 minutes each. Review all dates before confirming.'), /3.*60/);
});
test('Russian creation, clarifications and draft corrections work offline', async () => {
  const first = await runLocalAiAssistant('Добавь встречу', [], 'ru', now);
  assert.match(first.text, /На какой день/);
  const second = await runLocalAiAssistant('завтра', [], 'ru', now, first.context);
  assert.match(second.text, /Во сколько/);
  const draft = await runLocalAiAssistant('в 15 на 30 минут', [], 'ru', now, second.context);
  assert.equal(draft.suggestedEvent?.title, 'Встреча');
  assert.equal(draft.suggestedEvent?.startDate, '2026-10-22');
  assert.equal(draft.suggestedEvent?.endTime, '15:30');
  assert.match(draft.text, /Предлагаю событие/);
  const corrected = await runLocalAiAssistant('на час позже', [], 'ru', now, draft.context);
  assert.equal(corrected.suggestedEvent?.startTime, '16:00');
});
test('Russian search, agenda and rescheduling preserve existing event IDs', async () => {
  const original = event({ title: 'Встреча с Иваном', startDate: '2026-10-21', endDate: '2026-10-21' });
  const found = await runLocalAiAssistant('Найди встречу', [original], 'ru', now);
  assert.match(found.text, /Найденные события/);
  assert.match(found.text, /Встреча с Иваном/);
  const agenda = await runLocalAiAssistant('Что у меня сегодня?', [original], 'ru', now);
  assert.match(agenda.text, /Встреча с Иваном/);
  const move = await runLocalAiAssistant('Перенеси встречу на пятницу в 16', [original], 'ru', now);
  assert.equal(move.suggestedPlan?.kind, 'move');
  assert.equal(move.suggestedPlan?.events[0].id, original.id);
  assert.equal(move.suggestedPlan?.events[0].startDate, '2026-10-23');
  assert.equal(move.suggestedPlan?.events[0].startTime, '16:00');
  assert.match(move.text, /Проверьте/);
});
test('Russian dates, availability, batch planning and conflict responses', async () => {
  assert.equal(parseDateFromNaturalLanguage('через две недели', now, 'ru').dateStr, '2026-11-04');
  assert.equal(parseDateFromNaturalLanguage('23 октября', now, 'ru').dateStr, '2026-10-23');
  const free = await runLocalAiAssistant('Когда я свободен завтра на 60 минут?', [], 'ru', now);
  assert.match(free.text, /Свободные интервалы/);
  const batch = await runLocalAiAssistant('Запланируй три часовые тренировки на следующую неделю', [], 'ru', now);
  assert.equal(batch.suggestedPlan?.events.length, 3);
  assert.match(batch.text, /Подготовлено событий: 3/);
  assert.equal(batch.suggestedPlan?.events[0].startDate, '2026-10-26');
  const conflicts = await runLocalAiAssistant('Проверь конфликты', [], 'ru', now);
  assert.match(conflicts.text, /Пересечений не найдено/);
});
