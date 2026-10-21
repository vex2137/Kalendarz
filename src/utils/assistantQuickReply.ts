import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { runLocalAiAssistant, type AiResponseResult } from './aiEngine';

const copy = {
  pl: {
    greeting: 'Cześć! Mogę sprawdzić Twój plan, wolny czas i kolizje albo przygotować wydarzenie do zatwierdzenia. Napisz np. „Dodaj trening jutro o 18:00 na godzinę”.',
    help: 'Pomogę Ci z kalendarzem. Możesz napisać „Co mam dzisiaj w planie?”, „Sprawdź kolizje terminów” albo „Dodaj trening jutro o 18:00 na godzinę”. Jakie zadanie mam wykonać?',
    thanks: 'Nie ma za co! W czym jeszcze mogę pomóc z kalendarzem?',
  },
  en: {
    greeting: 'Hello! I can check your schedule, free time and conflicts, or prepare an event for confirmation. Try “Add workout tomorrow at 18:00 for one hour”.',
    help: 'I can help with your calendar. Try “What is on my schedule today?”, “Check for conflicts” or “Add workout tomorrow at 18:00 for one hour”. What would you like to do?',
    thanks: 'You’re welcome! What else can I help you with in your calendar?',
  },
  ru: {
    greeting: 'Привет! Я могу проверить расписание, свободное время и пересечения или предложить событие для подтверждения. Например: «Добавь тренировку завтра в 18:00 на час».',
    help: 'Я помогаю с календарём. Например: «Что у меня сегодня?», «Проверь пересечения» или «Добавь тренировку завтра в 18:00 на час». Что нужно сделать?',
    thanks: 'Пожалуйста! Чем ещё помочь с календарём?',
  },
  de: {
    greeting: 'Hallo! Ich kann Termine, freie Zeiten und Überschneidungen prüfen oder einen Termin zur Bestätigung vorbereiten. Zum Beispiel: „Füge morgen um 18:00 ein Training für eine Stunde hinzu“.',
    help: 'Ich helfe mit deinem Kalender. Zum Beispiel: „Was steht heute an?“, „Prüfe Überschneidungen“ oder „Füge morgen um 18:00 ein Training für eine Stunde hinzu“. Was möchtest du tun?',
    thanks: 'Gern! Wobei kann ich dir noch mit dem Kalender helfen?',
  },
};
const normalize = (text: string) => text.trim().toLowerCase().replace(/[.!?,…]+$/u, '').trim().replace(/\s+/g, ' ');
const greetings = new Set(['cześć', 'czesc', 'hej', 'siema', 'witaj', 'witam', 'dzień dobry', 'dzien dobry', 'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'привет', 'здравствуйте', 'добрый день', 'hallo', 'guten tag', 'guten morgen']);
const help = new Set(['co', 'co to', 'o co chodzi', 'co potrafisz', 'pomoc', 'help', 'what', 'what can you do', 'huh', 'что', 'что умеешь', 'помощь', 'was', 'was kannst du', 'hilfe']);
const thanks = new Set(['dzięki', 'dzieki', 'dziękuję', 'dziekuje', 'ok', 'dobra', 'thanks', 'thank you', 'okay', 'спасибо', 'хорошо', 'danke']);
const tools: [Set<string>, string][] = [
  [new Set(['sprawdź kolizje terminów', 'sprawdz kolizje terminow', 'sprawdź kolizje', 'check for conflicts', 'check for conflicting events', 'check conflicts', 'проверь пересечения', 'проверь конфликты', 'prüfe überschneidungen', 'prüfe konflikte']), 'Check for conflicts'],
  [new Set(['co mam dzisiaj w planie', 'mój plan', 'moj plan', 'what is on my schedule today', 'my schedule today', 'что у меня сегодня', 'мой план', 'was steht heute an', 'mein plan heute']), 'What is on my schedule today?'],
  [new Set(['kiedy mam wolne dzisiaj', 'wolny czas dzisiaj', 'when do i have free time today', 'когда я свободен сегодня', 'wann habe ich heute zeit']), 'When do I have free time today?'],
  [new Set(['czy mam wolny czwartek', 'wolny czwartek', 'do i have free time on thursday', 'я свободен в четверг', 'habe ich am donnerstag zeit']), 'When do I have free time on Thursday?'],
];

// Transparent deterministic routing for social messages and exact built-in shortcuts.
// It never substitutes canned output for model extraction of event commands.
export async function assistantQuickReply(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, preferences: PlanningPreferences): Promise<AiResponseResult | undefined> {
  const text = normalize(query);
  if (greetings.has(text)) return { text: copy[language].greeting };
  if (help.has(text)) return { text: copy[language].help };
  if (thanks.has(text)) return { text: copy[language].thanks };
  const tool = tools.find(([requests]) => requests.has(text));
  if (!tool) return undefined;
  const response = await runLocalAiAssistant(tool[1], events, language, now, {}, preferences);
  return { text: response.text, suggestedPrompts: response.suggestedPrompts };
}
