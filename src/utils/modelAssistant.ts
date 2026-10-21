import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { inferCalendarJson } from './localModelRuntime';
import { calendarSystemPrompt, COMMAND_SCHEMA, parseModelCommand, resolveModelCommand } from './modelCommand';

export interface ModelConversation { turns?: { role: 'user' | 'assistant'; content: string }[] }
export async function runModelAssistant(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences) {
  if (!query.trim() || query.length > 1000) throw new Error('model-input');
  // Bound history to protect small-device memory and the 2K context window.
  const turns = (context.turns || []).slice(-2).filter(t => t.content.length <= 1500);
  const prompt = (turns.length ? `Previous conversation (resolve follow-ups using these details):\n${JSON.stringify(turns)}\n` : '') + `Current request:\n${query}`;
  const raw = await inferCalendarJson(calendarSystemPrompt(language, now), prompt, COMMAND_SCHEMA);
  const result = await resolveModelCommand(parseModelCommand(raw), query, events, language, now, preferences);
  return { ...result, context: { turns: [...turns, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: JSON.stringify({ text: result.text, plan: result.suggestedPlan }) }].slice(-4) } };
}
