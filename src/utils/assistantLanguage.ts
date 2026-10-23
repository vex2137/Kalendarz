import type { AppLanguage } from './i18n';

// Detection uses command/date vocabulary, not the UI locale or quoted event names.
// Ambiguous fragments ("14:00", "OK", names) retain the conversation language.
const vocabulary: Record<AppLanguage, RegExp> = {
  pl: /^(?:czesc|hej|siema|witaj|witam|dzien|dobry|dzieki|dziekuje|pomoc|moj|dobra|co|potrafisz|dodaj|dodac|utworz\p{L}*|zaplanuj|zarezerwuj|przeloz|ustaw|chce|chcialbym|potrzebuje|czy|jak|zrob|zorganizuj|wpisz|wpisac|wrzuc\p{L}*|zapisz|zapisac|dopisz|dopisac|wstaw\p{L}*|przenies\p{L}*|przesun\p{L}*|zmien\p{L}*|usun\p{L}*|skas\p{L}*|wykresl\p{L}*|odwol\p{L}*|znajdz|znalezc|wyszuk\p{L}*|szukaj|pokaz\p{L}*|prosze|mozesz|moglbys|jutro|pojutrze|dzis\p{L}*|kiedy|mam|woln\p{L}*|sprawdz|kolizj\p{L}*|wydarzeni\p{L}*|godzin\p{L}*|minut\p{L}*|poniedzial\p{L}*|wtorek|wtork\p{L}*|srod\p{L}*|czwart\p{L}*|piatek|piatk\p{L}*|sobot\p{L}*|niedziel\p{L}*)$/u,
  en: /^(?:hello|hi|hey|good|morning|afternoon|help|huh|what|can|could|you|thanks|thank|add|create|schedule|put|move|reschedule|change|rename|delete|remove|cancel|find|search|show|please|tomorrow|today|when|free|check|conflicts|event|events|hour|hours|minutes|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/u,
  de: /^(?:hallo|guten|tag|morgen|ubermorgen|heute|danke|hilfe|was|kannst|du|fuge|erstelle|verschiebe|andere|losche|entferne|suche|finde|bitte|termin|termine|prufe|uberschneidungen|stunden|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)$/u,
  ru: /^(?:привет|здравствуйте|добрый|день|спасибо|хорошо|мой|план|помощь|что|умеешь|добавь|создай|перенеси|измени|удали|найди|проверь|пожалуйста|завтра|послезавтра|сегодня|когда|свобод\p{L}*|событи\p{L}*|встреч\p{L}*|час\p{L}*|минут\p{L}*)$/u,
};
export function normalizeAssistantInput(query: string) {
  // IME/paste can supply decomposed accents and invisible word separators.
  return query.normalize('NFC').replace(/[\u200B\uFEFF]/gu, '').trim();
}
export function detectAssistantLanguage(query: string, fallback: AppLanguage): AppLanguage {
  const text = normalizeAssistantInput(query).replace(/"[^"]*"|„[^”]*”|“[^”]*”|«[^»]*»/gu, ' ')
    .toLowerCase().normalize('NFD').replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC').replace(/ł/g, 'l');
  const tokens = text.match(/\p{L}+/gu) || [];
  const scores = (Object.keys(vocabulary) as AppLanguage[]).map(language => ({ language, score: tokens.reduce((sum, token, i) => sum + (vocabulary[language].test(token) ? (i === 0 ? 3 : 1) : 0), 0) }));
  const best = Math.max(...scores.map(s => s.score));
  const winners = scores.filter(s => s.score === best);
  return best > 0 && winners.length === 1 ? winners[0].language : fallback;
}
