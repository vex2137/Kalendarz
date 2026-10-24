import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { inferCalendarJson, touchLocalModel, modelStatus } from './localModelRuntime';
import { calendarSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } from './modelCommand';
import { assistantQuickReply } from './assistantQuickReply';
import { timeString } from './dates';
import { parseDateFromNaturalLanguage } from './aiEngine';
import { parseCalendarCommand } from './calendarCommandParser';
import type { ModelCommand } from './modelCommand';
import { recordModelMetric, recordAssistantTurn, type AssistantTurnMetric } from './modelDiagnostics';
import { detectAssistantLanguage, normalizeAssistantInput } from './assistantLanguage';

export interface ModelConversation { language?: AppLanguage; turns?: { role: 'user' | 'assistant'; content: string }[]; pending?: { command: ModelCommand; request: string } }
let requestSequence = 0;
export async function runModelAssistant(query: string, events: CalendarEvent[], uiLanguage: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences) {
  const started = performance.now();
  const normalized = normalizeAssistantInput(query);
  const language = detectAssistantLanguage(normalized, context.language || uiLanguage);
  const trace: AssistantTurnMetric = { id: ++requestSequence, uiLanguage, language, startedAt: started,
    quickChecked: false, quickMatched: false, rulesMatched: false, totalMs: 0,
    normalized: normalized !== query, inputLength: query.length,
    nonAsciiCount: [...query].filter(c => c.codePointAt(0)! > 127).length,
    modelPhaseAtSend: modelStatus().phase };
  try {
    const result = await runDetectedAssistant(normalized, events, language, now, context, preferences, trace);
    return { ...result, language, traceId: trace.id, context: { ...result.context, language } };
  } catch (error) { trace.error = true; throw error; }
  finally { trace.totalMs = performance.now() - started; recordAssistantTurn(trace); }
}
async function runDetectedAssistant(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences, trace: AssistantTurnMetric) {
  const started = performance.now();
  if (!query.trim() || query.length > 1000) throw new Error('model-input');
  touchLocalModel();
  trace.quickChecked = true;
  const quick = await assistantQuickReply(query, events, language, now, preferences);
  trace.quickMs = performance.now() - started;
  if (quick) { trace.quickMatched = true; trace.route = 'quick'; recordModelMetric({ route: 'quick', totalMs: performance.now() - started }); return { ...quick, context, route: 'quick' as const }; }
  const rulesStarted = performance.now();
  const parsed = parseCalendarCommand(query, language, now, context.pending);
  trace.rulesMs = performance.now() - rulesStarted;
  if (parsed) {
    trace.rulesMatched = true; trace.route = 'rules'; trace.commandAction = parsed.command.action;
    const result = await resolveModelCommand(parsed.command, parsed.request, events, language, now, preferences);
    recordModelMetric({ route: 'rules', totalMs: performance.now() - started });
    return { ...result, context: { turns: [{ role: 'user' as const, content: parsed.request }, { role: 'assistant' as const, content: JSON.stringify(parsed.command) }], ...(parsed.incomplete ? { pending: { command: parsed.command, request: parsed.request } } : {}) }, route: 'rules' as const };
  }
  // Bound history to protect small-device memory and the 2K context window.
  const pair = (context.turns || []).slice(-2);
  const turns = pair.length === 2 && pair[0].role === 'user' && pair[1].role === 'assistant' && pair.reduce((n, turn) => n + turn.content.length, 0) <= 1200 ? pair : [];
  const date = parseDateFromNaturalLanguage(query, now, language);
  const reference = date.matched ? `\nCalendar calculation for the date phrase in this request: ${date.dateStr}. For create/search use this exact date. For update distinguish original and new dates.` : '';
  const clock = /\b(?:teraz|now|za|in)\b|через|сейчас/iu.test(query) ? `\nCurrent local time: ${timeString(now.getHours() * 60 + now.getMinutes())}.` : '';
  trace.route = 'model';
  const raw = await inferCalendarJson(calendarSystemPrompt(language, now), `Current request:\n${query}${reference}${clock}`, commandSchemaForRequest(query), turns);
  const command = parseModelCommand(raw);
  trace.commandAction = command.action;
  const result = await resolveModelCommand(command, query, events, language, now, preferences);
  return { ...result, context: { turns: [...turns, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: raw }].slice(-4) }, route: 'model' as const };
}
