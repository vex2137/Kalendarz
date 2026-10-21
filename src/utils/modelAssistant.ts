import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { inferCalendarJson } from './localModelRuntime';
import { calendarSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } from './modelCommand';
import { parseDateFromNaturalLanguage } from './aiEngine';

export interface ModelConversation { turns?: { role: 'user' | 'assistant'; content: string }[] }
export async function runModelAssistant(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences) {
  if (!query.trim() || query.length > 1000) throw new Error('model-input');
  // Bound history to protect small-device memory and the 2K context window.
  const turns = (context.turns || []).slice(-2).filter(t => t.content.length <= 1500);
  const date = parseDateFromNaturalLanguage(query, now, language);
  const reference = date.matched ? `\nCalendar calculation for the date phrase in this request: ${date.dateStr}. For create/search use this exact date. For update distinguish original and new dates.` : '';
  const raw = await inferCalendarJson(calendarSystemPrompt(language, now), `Current request:\n${query}${reference}`, commandSchemaForRequest(query), turns);
  const result = await resolveModelCommand(parseModelCommand(raw), query, events, language, now, preferences);
  return { ...result, context: { turns: [...turns, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: raw }].slice(-4) } };
}
