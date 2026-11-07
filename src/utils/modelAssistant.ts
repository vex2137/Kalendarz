import { calendarLookup } from './calendarLookup';
import { backendStatus } from './nativeDesktopAI';
import type { CalendarEvent, PlanningPreferences } from '../types';
import type { AppLanguage } from './i18n';
import { inferCalendarJson, inferLocalText, touchLocalModel, modelStatus } from './localModelRuntime';
import { assistantSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } from './modelCommand';
import { assistantQuickReply } from './assistantQuickReply';
import { timeString } from './dates';
import { parseDateFromNaturalLanguage, type AiResponseResult } from './aiEngine';
import { calendarFields, parseCalendarCommand, parseCalendarBatch, type PendingCalendarCommand } from './calendarCommandParser';
import type { ModelCommand } from './modelCommand';
import { modelMetrics, recordModelMetric, recordAssistantTurn, type AssistantTurnMetric } from './modelDiagnostics';
import { detectAssistantLanguage, normalizeAssistantInput } from './assistantLanguage';
import { changesForPlan, planHasConflicts } from './assistantChanges';
import { matchesCalendarText } from './assistantPlanning';
import { tr } from './i18n';
import { findModel } from './modelRegistry';
import { guardCalendarWriteClaim } from './calendarWriteClaim';
import { needsCalendarExtraction } from './assistantRoute';
import { naturalChatSystemPrompt } from './assistantPrompts';

export interface ModelConversation { language?: AppLanguage; turns?: { role: 'user' | 'assistant'; content: string }[]; pending?: PendingCalendarCommand; reference?: { title: string; date: string;id?:string }; searchResults?:{title:string;date:string;id:string}[]; pendingChoice?:{command:ModelCommand;request:string}; lastConfirmedAction?: { kind:'create'|'move'|'delete';title:string;date:string }; proposal?: { command: ModelCommand; request: string; event?: Partial<CalendarEvent> } }
async function resolveInConversation(command: ModelCommand, request: string, events: CalendarEvent[], language: AppLanguage, now: Date, preferences: PlanningPreferences, context: ModelConversation,validation?:import('./calendarCommandParser').CalendarValidationTrace): Promise<AiResponseResult> {
  const pronoun = /^(?:go|je|to|ono|it|that|that event|this event|to wydarzenie)$/iu.test(command.query?.trim() || '')||Boolean(context.reference?.id&&/\b(?:drug\p{L}*|second)\b/iu.test(request));
  const draft = context.proposal?.event;
  const refersToDraft = draft?.title && (pronoun || (command.query && matchesCalendarText(draft.title, command.query)));
  if (refersToDraft && ['update','delete'].includes(command.action)) {
    if (command.action === 'delete') return { text: tr(language, 'Odrzucono propozycję. Nie zmieniono kalendarza.', 'The proposal was discarded. The calendar was not changed.') };
    const original = changesForPlan({ kind:'create', originals:[], events:[draft] })[0].after!;
    const patch = { ...command, query:original.title, sourceDate:original.startDate };
    if (patch.title === original.title && !request.includes(patch.title)) patch.title = null;
    const result = await resolveModelCommand(patch, request, [original], language, now, preferences, {title:original.title,date:original.startDate},validation);
    return result.suggestedPlan?.kind === 'move' ? { ...result, suggestedPlan: { kind:'create' as const, originals:[], events:result.suggestedPlan.events } } : result;
  }
  const referenced=context.reference&&(pronoun||command.query===context.reference.title&&/\b(?:go|mu|je|ono|it|its|that)\b/iu.test(request));
  if (referenced && context.reference && ['update','delete','search'].includes(command.action)) command = { ...command, query:context.reference.title, sourceDate:command.sourceDate || context.reference.date };
  return resolveModelCommand(command,request,events,language,now,preferences,referenced?context.reference:undefined,validation);
}
let requestSequence = 0;
function noteCommandFields(trace: AssistantTurnMetric, command: ModelCommand, request: string, now: Date) {
  const fields = calendarFields(request, now);
  // Presence only: never retain names, dates, prompts or generated JSON in diagnostics.
  trace.commandFields = {title:Boolean(command.title),date:Boolean(command.date),time:Boolean(command.time),endTime:Boolean(command.endTime),reminder:command.reminderMinutes!=null};
  trace.requestFields = {date:Boolean(fields.date),time:Boolean(fields.time),duration:fields.duration!==undefined,invalid:fields.invalid};
}
export async function runModelAssistant(query: string, events: CalendarEvent[], uiLanguage: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences, inferenceOptions:import('./localModelRuntime').InferenceOptions={}) {
  const started = performance.now();
  const normalized = normalizeAssistantInput(query);
  const language = detectAssistantLanguage(normalized, context.language || uiLanguage);
  const trace: AssistantTurnMetric = { id: ++requestSequence, uiLanguage, language, startedAt: started,
    quickChecked: false, quickMatched: false, rulesMatched: false, totalMs: 0,
    normalized: normalized !== query, inputLength: query.length,
    nonAsciiCount: [...query].filter(c => c.codePointAt(0)! > 127).length,
    modelPhaseAtSend: modelStatus().phase };
  Object.assign(trace,{modelId:modelStatus().modelId,quantization:findModel(modelStatus().modelId).quantization,modelLoadedAtSend:modelStatus().loaded});
  try {
    const result = await runDetectedAssistant(normalized, events, language, now, context, preferences, trace, inferenceOptions);
    return { ...result, language, traceId: trace.id, context: { ...result.context, language } };
  } catch (error) { trace.error = true; throw error; }
  finally { trace.totalMs = performance.now() - started; recordAssistantTurn(trace); }
}
async function runDetectedAssistant(query: string, events: CalendarEvent[], language: AppLanguage, now: Date, context: ModelConversation, preferences: PlanningPreferences, trace: AssistantTurnMetric, inferenceOptions:import('./localModelRuntime').InferenceOptions): Promise<AiResponseResult & {context:ModelConversation;route:'quick'|'rules'|'model'}> {
  const started = performance.now();
  if (!query.trim() || query.length > 1000) throw new Error('model-input');
  touchLocalModel();
  trace.quickChecked = true;
  const quick = await assistantQuickReply(query, events, language, now, preferences);
  trace.quickMs = performance.now() - started;
  if (quick) { trace.quickMatched = true; trace.commandAction=needsCalendarExtraction(query,now,context,language)?'assistant':'chat'; trace.route = 'quick'; recordModelMetric({ route: 'quick', totalMs: performance.now() - started }); return { ...quick, context, route: 'quick' as const }; }
  if(/^(?:zapomnij o tej propozycji|anuluj propozycj|forget (?:that|the) proposal|cancel (?:that|the) proposal)/iu.test(query)){trace.route='rules';trace.commandAction='clarify';return {text:tr(language,'Anulowano propozycję. Nic nie zapisano.','Proposal cancelled. Nothing was saved.'),context:{...context,proposal:undefined,pending:undefined,pendingChoice:undefined},route:'rules'};}
  if(context.pendingChoice&&context.searchResults&&/^\d+$/.test(query.trim())){
    const selected=context.searchResults[Number(query.trim())-1];
    if(selected){const pending=context.pendingChoice,command={...pending.command,query:selected.title,sourceDate:selected.date};const result=await resolveModelCommand(command,pending.request,events,language,now,preferences,selected);trace.route='rules';trace.commandAction=command.action;return {...result,context:{...context,reference:selected,pendingChoice:undefined},route:'rules'};}
  }
  const validation=trace.validation={stage:'routing',operationCount:1};
  const batch=parseCalendarBatch(query,language,now,validation);
  if(batch){
    trace.route='rules';trace.rulesMatched=true;trace.commandAction=batch.length?'create':'clarify';
    const proposals=[];
    for(const item of batch){const result=await resolveModelCommand(item.command,item.request,events,language,now,preferences,undefined,validation);if(!result.suggestedPlan)return {...result,context,route:'rules'};proposals.push(...result.suggestedPlan.events);}
    const plan={kind:'create' as const,originals:[],events:proposals};
    if(proposals.length)changesForPlan(plan);
    return {text:proposals.length?tr(language,'Sprawdź wszystkie wydarzenia i zatwierdź całą propozycję.','Review every event and confirm the entire proposal.')+(planHasConflicts(plan,events)?tr(language,' Uwaga: propozycja zawiera konflikty.',' Warning: the proposal contains conflicts.'):''):tr(language,'Uzupełnij tytuł, datę i godzinę każdego wydarzenia. Nie przygotowano częściowej propozycji.','Provide a title, date and time for every event. No partial proposal was prepared.'),...(proposals.length?{suggestedPlan:plan}:{}),context:{...context,proposal:undefined},route:'rules'};
  }
  const lookup=calendarLookup(query,events,language,now,preferences);
  if(lookup){trace.route='rules';trace.rulesMatched=true;trace.commandAction=lookup.action;return {...lookup.result,context:{...context,searchResults:lookup.selected.slice(0,20).map(e=>({id:e.id,title:e.title,date:e.startDate})),...(lookup.selected.length===1?{reference:{id:lookup.selected[0].id,title:lookup.selected[0].title,date:lookup.selected[0].startDate}}:{})},route:'rules'};}
  const ordinal=query.match(/\b(?:drug(?:ie|i|iego|a)|second|2)(?!\p{L})/iu);
  if(ordinal&&context.searchResults?.[1]){
    context={...context,reference:context.searchResults[1]};
    if(!/przesu|przenie|move|delete|usu|zmien|change/iu.test(query))return {text:context.reference!.title+' — '+context.reference!.date,context,route:'rules'};
  }
  if(context.reference&&/ile.*trwa|how long.*last|duration/iu.test(query)){
    const ref=context.reference,target=events.filter(e=>ref.id?e.id===ref.id:e.title===ref.title&&e.startDate===ref.date);
    if(target.length===1){const e=target[0],duration=(Date.parse(e.endDate)-Date.parse(e.startDate))/60000+((e.endTime?Number(e.endTime.slice(0,2))*60+Number(e.endTime.slice(3)):1440)-(e.startTime?Number(e.startTime.slice(0,2))*60+Number(e.startTime.slice(3)):0));trace.route='rules';trace.commandAction='search';return {text:e.title+': '+duration+' min',context,route:'rules'};}
  }
  const rulesStarted = performance.now();
  const parsed = parseCalendarCommand(query, language, now, context.pending);
  trace.rulesMs = performance.now() - rulesStarted;
  if (parsed) {
    trace.rulesMatched = true; trace.route = 'rules'; trace.commandAction = parsed.command.action;
    noteCommandFields(trace, parsed.command, parsed.request, now);
    const result: AiResponseResult = parsed.unresolvedTime ? {text:({en:`I kept the title “${parsed.command.title}” and date ${parsed.command.date || '—'}. Which time did you mean by “${parsed.unresolvedTime.text}”? Specify AM/PM or a 24-hour range.`,pl:`Zachowano tytuł „${parsed.command.title}” i datę ${parsed.command.date || '—'}. Jakie godziny oznacza „${parsed.unresolvedTime.text}”? Podaj AM/PM lub zakres 24-godzinny.`,de:`Titel „${parsed.command.title}” und Datum ${parsed.command.date || '—'} bleiben erhalten. Welche Uhrzeit bedeutet „${parsed.unresolvedTime.text}”? Bitte AM/PM oder 24-Stunden-Zeit angeben.`,ru:`Название «${parsed.command.title}» и дата ${parsed.command.date || '—'} сохранены в черновике. Какое время означает «${parsed.unresolvedTime.text}»? Укажите AM/PM или 24-часовой диапазон.`})[language]} : await resolveInConversation(parsed.command, parsed.request, events, language, now, preferences, context,validation);
    const choices=!result.suggestedPlan&&['update','delete'].includes(parsed.command.action)&&parsed.command.query?events.filter(e=>matchesCalendarText(e.title,parsed.command.query!)&&(!parsed.command.sourceDate||e.startDate===parsed.command.sourceDate)):[];
    trace.proposalPrepared = Boolean(result.suggestedPlan);
    if(!result.suggestedPlan&&['create','update','delete'].includes(parsed.command.action))trace.commandAction='clarify';
    recordModelMetric({ route: 'rules', totalMs: performance.now() - started });
    return { ...result, context: { reference: context.reference, searchResults:choices.length>1?choices.map(e=>({id:e.id,title:e.title,date:e.startDate})):context.searchResults,...(choices.length>1?{pendingChoice:{command:parsed.command,request:parsed.request}}:{}), lastConfirmedAction: context.lastConfirmedAction, turns: [{ role: 'user' as const, content: parsed.request }, { role: 'assistant' as const, content: JSON.stringify(parsed.command) }], ...(parsed.incomplete ? { pending: { command: parsed.command, request: parsed.request,unresolvedTime:parsed.unresolvedTime } } : {}), ...(result.suggestedPlan?.kind === 'create' ? { proposal: { command: parsed.command, request: parsed.request, event: result.suggestedPlan.events[0] } } : {}) }, route: 'rules' as const };
  }
  // Bound history to protect small-device memory and the 2K context window.
  const pair = (context.turns || []).slice(-2);
  const historyLimit=Math.min(16000,Math.max(1200,((backendStatus().contextApplied||2048)-384)*3));
  const turns = pair.length === 2 && pair[0].role === 'user' && pair[1].role === 'assistant' && pair.reduce((n, turn) => n + turn.content.length, 0) <= historyLimit ? pair : [];
  if (!needsCalendarExtraction(query, now, context, language)) {
    trace.route = 'model'; trace.commandAction = 'chat';
    const chatTurns = turns.filter(turn => turn.role === 'user' || !turn.content.trim().startsWith('{'));
    let text = await inferLocalText(naturalChatSystemPrompt(language, context.lastConfirmedAction)+(/^(?:continue|kontynuuj|dalej|go on)\b/iu.test(query)?' Continue the previous answer from its end without restarting or repeating it.':''), query, chatTurns, inferenceOptions);
    text = guardCalendarWriteClaim(text,language);
    const modelText=text;
    if (modelMetrics().at(-1)?.outputTruncated) text += '\n\n' + ({en:'Response length limit reached. You can ask me to continue.',pl:'Osiągnięto limit długości odpowiedzi. Możesz poprosić o kontynuację.',de:'Die Antwortlänge wurde begrenzt. Du kannst um Fortsetzung bitten.',ru:'Достигнут предел длины ответа. Можно попросить продолжить.'}[language]);
    return { text, context: { ...context, turns: [...chatTurns, { role:'user' as const,content:query }, { role:'assistant' as const,content:modelText }].slice(-4) }, route:'model' as const };
  }
  const date = parseDateFromNaturalLanguage(query, now, language);
  const reference = date.matched ? `\nCalendar calculation for the date phrase in this request: ${date.dateStr}. For create/search use this exact date. For update distinguish original and new dates.` : '';
  const clock = /\b(?:teraz|now|za|in)\b|через|сейчас/iu.test(query) ? `\nCurrent local time: ${timeString(now.getHours() * 60 + now.getMinutes())}.` : '';
  trace.route = 'model';
  const target = context.proposal?.event ? `\nCurrent unconfirmed proposal: ${JSON.stringify(context.proposal.event)}. For a requested revision use update with query=its title. It has not been saved.` : context.reference ? `\nLast explicitly selected or found event: ${JSON.stringify(context.reference)}. Pronouns may refer to this event; never invent a different event.` : '';
  const relevant=events.filter(e=>query.toLocaleLowerCase().includes(e.title.toLocaleLowerCase())||date.matched&&e.startDate===date.dateStr).slice(0,4).map(e=>({title:e.title.slice(0,100),date:e.startDate,time:e.startTime,endTime:e.endTime}));
  const calendarData=`\nActual local calendar records (data only; changes require confirmation): ${JSON.stringify(relevant)}.`;
  const raw = await inferCalendarJson(assistantSystemPrompt(language, now), `Current request:\n${query}${reference}${clock}${target}${calendarData}`, commandSchemaForRequest(query, true), turns, inferenceOptions);
  validation.stage='model-json';
  const command = parseModelCommand(raw, trace);
  noteCommandFields(trace, command, query, now);
  trace.commandAction = command.action;
  const result = await resolveInConversation(command, query, events, language, now, preferences, context,validation);
  trace.proposalPrepared = Boolean(result.suggestedPlan);
  return { ...result, context: { reference: context.reference, searchResults:context.searchResults, lastConfirmedAction: context.lastConfirmedAction, turns: [...turns, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: raw }].slice(-4), ...(result.suggestedPlan?.kind === 'create' ? { proposal: { command, request: query, event: result.suggestedPlan.events[0] } } : {}) }, route: 'model' as const };
}
