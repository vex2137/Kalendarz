import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { inferCalendarJson, inferLocalText, touchLocalModel, modelStatus } from './localModelRuntime';
import { assistantSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } from './modelCommand';
import { assistantQuickReply } from './assistantQuickReply';
import { timeString } from './dates';
import { parseDateFromNaturalLanguage, type AiResponseResult } from './aiEngine';
import { parseCalendarCommand } from './calendarCommandParser';
import type { ModelCommand } from './modelCommand';
import { modelMetrics, recordModelMetric, recordAssistantTurn, type AssistantTurnMetric } from './modelDiagnostics';
import { detectAssistantLanguage, normalizeAssistantInput } from './assistantLanguage';
import { changesForPlan } from './assistantChanges';
import { matchesCalendarText } from './assistantPlanning';
import { tr } from './i18n';
import { needsCalendarExtraction } from './assistantRoute';

export interface ModelConversation { language?: AppLanguage; turns?: { role: 'user' | 'assistant'; content: string }[]; pending?: { command: ModelCommand; request: string }; reference?: { title: string; date: string }; lastConfirmedAction?: { kind:'create'|'move'|'delete';title:string;date:string }; proposal?: { command: ModelCommand; request: string; event?: Partial<CalendarEvent> } }
async function resolveInConversation(command: ModelCommand, request: string, events: CalendarEvent[], language: AppLanguage, now: Date, preferences: PlanningPreferences, context: ModelConversation): Promise<AiResponseResult> {
  const pronoun = /^(?:go|je|to|ono|it|that|that event|this event|to wydarzenie)$/iu.test(command.query?.trim() || '');
  const draft = context.proposal?.event;
  const refersToDraft = draft?.title && (pronoun || (command.query && matchesCalendarText(draft.title, command.query)));
  if (refersToDraft && ['update','delete'].includes(command.action)) {
    if (command.action === 'delete') return { text: tr(language, 'Odrzucono propozycję. Nie zmieniono kalendarza.', 'The proposal was discarded. The calendar was not changed.') };
    const original = changesForPlan({ kind:'create', originals:[], events:[draft] })[0].after!;
    const patch = { ...command, query:original.title, sourceDate:original.startDate };
    if (patch.title === original.title && !request.includes(patch.title)) patch.title = null;
    const result = await resolveModelCommand(patch, request, [original], language, now, preferences, {title:original.title,date:original.startDate});
    return result.suggestedPlan?.kind === 'move' ? { ...result, suggestedPlan: { kind:'create' as const, originals:[], events:result.suggestedPlan.events } } : result;
  }
  const referenced=context.reference&&(pronoun||command.query===context.reference.title&&/\b(?:go|mu|je|ono|it|its|that)\b/iu.test(request));
  if (referenced && context.reference && ['update','delete','search'].includes(command.action)) command = { ...command, query:context.reference.title, sourceDate:command.sourceDate || context.reference.date };
  return resolveModelCommand(command,request,events,language,now,preferences,referenced?context.reference:undefined);
}
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
async function runDetectedAssistant(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences, trace: AssistantTurnMetric): Promise<AiResponseResult & {context:ModelConversation;route:'quick'|'rules'|'model'}> {
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
    const result = await resolveInConversation(parsed.command, parsed.request, events, language, now, preferences, context);
    recordModelMetric({ route: 'rules', totalMs: performance.now() - started });
    return { ...result, context: { reference: context.reference, lastConfirmedAction: context.lastConfirmedAction, turns: [{ role: 'user' as const, content: parsed.request }, { role: 'assistant' as const, content: JSON.stringify(parsed.command) }], ...(parsed.incomplete ? { pending: { command: parsed.command, request: parsed.request } } : {}), ...(result.suggestedPlan?.kind === 'create' ? { proposal: { command: parsed.command, request: parsed.request, event: result.suggestedPlan.events[0] } } : {}) }, route: 'rules' as const };
  }
  // Bound history to protect small-device memory and the 2K context window.
  const pair = (context.turns || []).slice(-2);
  const historyLimit = modelStatus().modelId === 'lfm2.5-2.6b-q4-k-m' ? 500 : 1200;
  const turns = pair.length === 2 && pair[0].role === 'user' && pair[1].role === 'assistant' && pair.reduce((n, turn) => n + turn.content.length, 0) <= historyLimit ? pair : [];
  if (!needsCalendarExtraction(query, now, context, language)) {
    trace.route = 'model'; trace.commandAction = 'chat';
    const chatTurns = turns.filter(turn => turn.role === 'user' || !turn.content.trim().startsWith('{'));
    const confirmed = context.lastConfirmedAction ? ` The only last confirmed calendar action is: ${JSON.stringify(context.lastConfirmedAction)}.` : '';
    let text = await inferLocalText(`You are a helpful offline assistant. Have a natural conversation. Keep your answer brief, usually two sentences. Reply in the user's actual language (${language} is a hint), respecting explicit language requests. Never invent calendar changes. Calendar mutations require a separate validated proposal and confirmation.${confirmed}`, query, chatTurns);
    if (modelMetrics().at(-1)?.outputTruncated) text += '\n\n' + ({en:'Response length limit reached. You can ask me to continue.',pl:'Osiągnięto limit długości odpowiedzi. Możesz poprosić o kontynuację.',de:'Die Antwortlänge wurde begrenzt. Du kannst um Fortsetzung bitten.',ru:'Достигнут предел длины ответа. Можно попросить продолжить.'}[language]);
    return { text, context: { ...context, turns: [...chatTurns, { role:'user' as const,content:query }, { role:'assistant' as const,content:text }].slice(-4) }, route:'model' as const };
  }
  const date = parseDateFromNaturalLanguage(query, now, language);
  const reference = date.matched ? `\nCalendar calculation for the date phrase in this request: ${date.dateStr}. For create/search use this exact date. For update distinguish original and new dates.` : '';
  const clock = /\b(?:teraz|now|za|in)\b|через|сейчас/iu.test(query) ? `\nCurrent local time: ${timeString(now.getHours() * 60 + now.getMinutes())}.` : '';
  trace.route = 'model';
  const target = context.proposal?.event ? `\nCurrent unconfirmed proposal: ${JSON.stringify(context.proposal.event)}. For a requested revision use update with query=its title. It has not been saved.` : context.reference ? `\nLast explicitly confirmed event: ${JSON.stringify(context.reference)}. Pronouns may refer to this event; never invent a different event.` : '';
  const raw = await inferCalendarJson(assistantSystemPrompt(language, now), `Current request:\n${query}${reference}${clock}${target}`, commandSchemaForRequest(query, true), turns);
  const command = parseModelCommand(raw);
  trace.commandAction = command.action;
  const result = await resolveInConversation(command, query, events, language, now, preferences, context);
  return { ...result, context: { reference: context.reference, lastConfirmedAction: context.lastConfirmedAction, turns: [...turns, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: raw }].slice(-4), ...(result.suggestedPlan?.kind === 'create' ? { proposal: { command, request: query, event: result.suggestedPlan.events[0] } } : {}) }, route: 'model' as const };
}
