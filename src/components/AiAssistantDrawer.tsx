import { tr } from '../utils/i18n';
import type { AssistantPlan } from '../utils/assistantPlanning';
import { planningPreferences } from '../utils/assistantPlanning';
import { Dialog } from './Dialog';
import React, { useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { CalendarEvent, AiChatMessage, AiSettings } from '../types';
import { runModelAssistant, type ModelConversation } from '../utils/modelAssistant';
import { cancelModelOperation, checkLocalModel, modelStatus, subscribeModel, setAssistantActive } from '../utils/localModelRuntime';
import { localModelText } from '../utils/localModelText';
import { AiSettingsPanel } from './AiSettingsPanel';
import { aiSettingsText } from '../utils/aiSettingsText';
import { modelErrorText } from '../utils/aiSettingsText';
import { detectAssistantLanguage } from '../utils/assistantLanguage';
import { recordAssistantUiCommit, observeAssistantSession, markAssistantInputReady } from '../utils/modelDiagnostics';
import { assistantUiText } from '../utils/assistantUiText';
import { findModel, shortModelName } from '../utils/modelRegistry';
import { chatMessages, createOrReuseEmptyChat, getChat, rememberChat, resolveActiveChat, saveChat } from '../utils/chatHistory';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { MarkdownMessage } from './MarkdownMessage';
import { getTranslation, AppLanguage } from '../utils/i18n';
import {
  X,
  Sparkles,
  Send,
  Cpu,
  AlertCircle,
  RotateCcw,
  History,
  Settings,
  Undo2,
  MessageSquarePlus,
} from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onApplyPlan: (plan: AssistantPlan) => Promise<void>;
  onUndo: () => Promise<void>;
  canUndo: boolean;
  aiSettings: AiSettings;
  language?: AppLanguage;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onApplyPlan,
  onUndo,
  canUndo,
  aiSettings,
  language = 'en',
}) => {
  const t = getTranslation(language);
  const model = useSyncExternalStore(subscribeModel, modelStatus);
  const modelText = localModelText(language);
  const ui = assistantUiText(language);

  const defaultMsg: AiChatMessage = {
    id: 'msg-welcome',
    role: 'assistant',
    content: localModelText(language).introduction,
    timestamp: Date.now(),
    suggestedPrompts:
      tr(language, [
            'Co mam dzisiaj w planie?',
            'Kiedy mam wolne dzisiaj?',
            'Czy mam wolny czwartek?',
            'Sprawdź kolizje terminów',
          ], [
            'What is on my schedule today?',
            'When do I have free time today?',
            'Check for conflicting events',
            'Summary of this week',
          ]),
  };

  const [messages, setMessages] = useState<AiChatMessage[]>([defaultMsg]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedEventsIds, setAddedEventsIds] = useState<string[]>([]);
  const operationRef = useRef(false);
  const conversationRef = useRef<ModelConversation>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const presentationRef = useRef<number | undefined>(undefined);
  const chatIdRef = useRef<string | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [historyReady, setHistoryReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const returnFocus = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!settingsOpen && !historyOpen && returnFocus.current) {
      const target = returnFocus.current;
      // Wait for WebView to apply visibility/inert changes before moving focus.
      let attempts=0;
      let timer: ReturnType<typeof setTimeout>;
      const restore = () => {
        const element=document.getElementById(target);
        element?.focus({preventScroll:true});
        if(element && document.activeElement===element) returnFocus.current=undefined;
        else if(attempts++<30) timer=setTimeout(restore,16);
      };
      timer=setTimeout(restore,100);
      return () => clearTimeout(timer);
    }
  }, [settingsOpen, historyOpen]);
  const [historyError, setHistoryError] = useState(false);
  const persist = (snapshot: AiChatMessage[], context = conversationRef.current) => {
    const id = chatIdRef.current;
    if (!id) return Promise.resolve();
    const copy = structuredClone(context), selected = model.modelId;
    const next = saveQueue.current.catch(() => {}).then(() => saveChat(id, snapshot, copy, selected));
    saveQueue.current = next;
    return next.catch(() => { setHistoryError(true); });
  };

  useEffect(() => { if (isOpen) return observeAssistantSession(); }, [isOpen]);
  useEffect(() => { if (isOpen && model.installed) markAssistantInputReady(); }, [isOpen, model.installed]);
  useEffect(() => {
    if (presentationRef.current !== undefined) {
      recordAssistantUiCommit(presentationRef.current);
      presentationRef.current = undefined;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !historyOpen && !settingsOpen) {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    setHistoryReady(false);
    void (async () => {
      await saveQueue.current.catch(() => {});
      const chat = await resolveActiveChat(ui.newChat, model.modelId);
      const stored = await chatMessages(chat.id);
      if (!current) return;
      chatIdRef.current = chat.id; rememberChat(chat.id);
      conversationRef.current = chat.context || {turns:stored.filter(m=>m.role!=='system'&&m.id!=='msg-welcome').slice(-2).map(m=>({role:m.role as 'user'|'assistant',content:m.content.slice(0,600)}))};
      setMessages(stored.length ? stored : [defaultMsg]);
      setAddedEventsIds([]); setHistoryReady(true);
    })().catch(() => { if (current) setHistoryError(true); });
    return () => { current = false; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) void checkLocalModel();
    setAssistantActive(isOpen && aiSettings.enabled);
    return () => setAssistantActive(false);
  }, [isOpen, aiSettings.enabled]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || operationRef.current || !aiSettings.enabled || !historyReady) return;
    operationRef.current = true;

    const userMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      modelId: model.modelId,
    };

    const withUser = [...messages.slice(-199).map(message => ({ ...message, suggestedEvent: undefined, suggestedPlan: undefined })), userMessage];
    setMessages(withUser);
    setInputQuery('');
    setIsProcessing(true);

    try {
      await persist(withUser);
      const response = await runModelAssistant(text, events, language, new Date(), conversationRef.current, planningPreferences(aiSettings.planning));
      presentationRef.current = response.traceId;
      conversationRef.current = response.context || {};
      setMessages(prev => prev.map(message => ({ ...message, suggestedEvent: undefined, suggestedPlan: undefined })));
      const assistantMessage: AiChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        suggestedEvent: response.suggestedEvent,
        suggestedPlan: response.suggestedPlan,
        suggestedPrompts: response.suggestedPrompts,
        modelId: model.modelId,
        route: response.route,
      };
      const next = [...withUser, assistantMessage];
      setMessages(next);
      await persist(next);
    } catch (error) {
      const current = modelStatus();
      const replyLanguage = detectAssistantLanguage(text,conversationRef.current.language || language);
      const next: AiChatMessage[] = [
        ...withUser,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            current.error === 'model-missing' || current.phase === 'missing' ? assistantUiText(replyLanguage).modelMissing : error instanceof Error && error.message.startsWith('model-') ? modelErrorText(error.message,replyLanguage) : localModelText(replyLanguage).inputError,
          timestamp: Date.now(),
          suggestedPrompts:
            tr(language, ['Co mam dzisiaj w planie?', 'Kiedy mam wolne dzisiaj?'], [
                  'What is on my schedule today?',
                  'When do I have free time today?',
                ]),
        },
      ];
      setMessages(next); await persist(next);
    } finally {
      operationRef.current = false;
      setIsProcessing(false);
    }
  };

  const startNewChat = async () => {
    if (operationRef.current) return;
    operationRef.current = true; setIsProcessing(true);
    try {
      await saveQueue.current.catch(() => {});
      const chat = await createOrReuseEmptyChat(ui.newChat, model.modelId, chatIdRef.current);
      chatIdRef.current = chat.id; conversationRef.current = {};
      setMessages([{ ...defaultMsg, timestamp: Date.now() }]); setAddedEventsIds([]);
      setInputQuery('');
      setHistoryReady(true); setHistoryOpen(false); setHistoryError(false);
    } catch { setHistoryError(true); } finally { operationRef.current = false; setIsProcessing(false); }
  };
  const handleClearChat = () => { void startNewChat(); };
  const selectChat = async (id: string) => {
    if (operationRef.current) return;
    operationRef.current = true;
    try {
      await saveQueue.current.catch(() => {});
      const chat = await getChat(id); if (!chat) throw new Error('chat-missing');
      const stored = await chatMessages(id);
      chatIdRef.current = id; rememberChat(id); conversationRef.current = chat.context || {
        turns: stored.filter(m => m.role !== 'system' && m.id !== 'msg-welcome').slice(-2).map(m => ({ role: m.role as 'user'|'assistant', content: m.content.slice(0,600) })),
      };
      setMessages(stored.length ? stored : [defaultMsg]); setInputQuery(''); setAddedEventsIds([]); setHistoryOpen(false);
    } catch { setHistoryError(true); } finally { operationRef.current = false; }
  };

  const handleConfirm = async (msgId: string, plan: AssistantPlan) => {
    if (operationRef.current || !aiSettings.enabled || addedEventsIds.includes(msgId)) return;
    operationRef.current = true;
    try {
      setIsProcessing(true);
      await onApplyPlan(plan);
      conversationRef.current = { ...conversationRef.current, pending: undefined, proposal: undefined, lastConfirmedAction: {kind:plan.kind,title:plan.events[0].title!,date:plan.events[0].startDate!}, reference: plan.kind === 'delete' ? undefined : { title: plan.events[0].title!, date: plan.events[0].startDate! } };
      setAddedEventsIds(prev => [...prev, msgId]);
      const next: AiChatMessage[] = [...messages, { id: crypto.randomUUID(), role: 'assistant', content: tr(language, 'Zapisano zmiany.', 'Changes saved.'), timestamp: Date.now() }];
      setMessages(next); await persist(next);
    } catch (error) {
      const next: AiChatMessage[] = [...messages, { id: crypto.randomUUID(), role: 'assistant', content: String(error), timestamp: Date.now() }];
      setMessages(next); await persist(next);
    } finally {
      operationRef.current = false;
      setIsProcessing(false);
    }
  };

  const closeHistory = () => { returnFocus.current = 'btn-ai-chat-history'; setHistoryOpen(false); };
  const closeSettings = () => { returnFocus.current = 'btn-ai-settings'; setSettingsOpen(false); };
  const handleUndo = async () => {
    if (operationRef.current || !canUndo) return;
    operationRef.current = true;
    setIsProcessing(true);
    try {
      await onUndo();
      conversationRef.current = {};
      const next: AiChatMessage[] = [...messages.map(m => ({ ...m, suggestedEvent: undefined, suggestedPlan: undefined })), { id: crypto.randomUUID(), role: 'assistant', content: tr(language, 'Cofnięto ostatnią operację asystenta.', 'The last assistant operation was undone.'), timestamp: Date.now() }];
      setMessages(next); await persist(next);
    } catch (error) {
      const next: AiChatMessage[] = [...messages, { id: crypto.randomUUID(), role: 'assistant', content: String(error), timestamp: Date.now() }];
      setMessages(next); await persist(next);
    } finally {
      operationRef.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      onClose={settingsOpen ? closeSettings : historyOpen ? closeHistory : onClose}
      label={settingsOpen ? aiSettingsText(language).settings : historyOpen ? ui.conversations : t.aiAssistantTitle}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
    >
      <div
        id="drawer-ai-assistant"
        inert={historyOpen || settingsOpen}
        aria-hidden={historyOpen || settingsOpen || undefined}
        className={`theme-surface w-full max-w-md h-full shadow-2xl flex flex-col motion-safe:animate-in motion-safe:slide-in-from-right duration-200 theme-border border-l ${historyOpen || settingsOpen ? 'invisible pointer-events-none' : ''}`}
      >
        {/* Header */}
        <div id="ai-assistant-header" className="px-3 py-2 theme-border border-b theme-subtle flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-36">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold theme-text">
                  {t.aiAssistantTitle}
                </h3>
              </div>
              <div className="flex items-center gap-1 text-[11px] theme-muted">
                <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                <span data-testid="model-header-name" className="truncate">{shortModelName(findModel(model.modelId))}</span>
                <span className="shrink-0">· Offline</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 ml-auto">
            <button type="button" id="btn-ai-settings" aria-label={aiSettingsText(language).settings} title={aiSettingsText(language).settings} onClick={() => setSettingsOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-lg theme-muted theme-hover"><Settings className="w-6 h-6"/></button>
            <button type="button" id="btn-ai-chat-history" aria-label={ui.conversations} title={ui.conversations} disabled={isProcessing || !historyReady} onClick={() => setHistoryOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-lg theme-muted theme-hover"><History className="w-6 h-6"/></button>
            <button
              type="button"
              onClick={handleClearChat}
              className="w-11 h-11 flex items-center justify-center rounded-lg theme-muted theme-hover transition-colors"
              id="btn-new-ai-chat"
              title={ui.newChat}
              aria-label={ui.newChat}
              disabled={isProcessing || !aiSettings.enabled}
            >
              <MessageSquarePlus className="w-6 h-6" />
            </button>
            <button
              id="btn-close-ai-drawer"
              aria-label={t.close}
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-lg theme-muted theme-hover transition-colors"
              title={tr(language, 'Zamknij asystenta', 'Close assistant')}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {historyError && <p role="alert" className="p-2 text-xs">{ui.historyError}</p>}
        {isProcessing && <div role="status" className="p-2 text-xs flex justify-between gap-2"><span>{model.phase === 'running' ? ui.generating : modelText[model.phase]}</span><button type="button" id="btn-stop-ai-generation" className="underline" onClick={cancelModelOperation}>{ui.cancel}</button></div>}

        {canUndo && <button id="btn-undo-ai" type="button" onClick={handleUndo} disabled={isProcessing || !aiSettings.enabled} className="m-2 min-h-11 px-3 py-2 flex items-center justify-center gap-2 rounded theme-surface theme-text theme-border border text-sm">
          <Undo2 className="w-6 h-6 shrink-0"/>
          {tr(language, 'Cofnij ostatnią operację asystenta', 'Undo last assistant operation')}
        </button>}

        {/* Warning if AI is disabled in settings */}
        {!aiSettings.enabled && (
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {tr(language, 'Asystent jest wyłączony. Włącz go w ustawieniach.', 'The assistant is disabled. Enable it in settings.')}
            </span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 theme-subtle theme-border border-b flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                tr(language, 'Kiedy mam wolne dzisiaj?', 'When do I have free time today?'),
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🔍</span>{' '}
            {tr(language, 'Wolny czas dzisiaj', 'Free time today')}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                tr(language, 'Co mam zaplanowane na dzisiaj?', 'What is on for today?'),
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📅</span> {tr(language, 'Mój plan', 'My schedule')}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                tr(language, 'Czy mam wolny czwartek?', 'Am I free on Thursday?'),
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🗓️</span>{' '}
            {tr(language, 'Wolny czwartek?', 'Free Thursday?')}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                tr(language, 'Czy mam jakieś kolizje w terminach?', 'Check for conflicting events'),
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>⚠️</span> {tr(language, 'Kolizje', 'Conflicts')}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                tr(language, 'Podsumuj mój nadchodzący tydzień', 'Summary of this week'),
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📊</span> {tr(language, 'Tydzień', 'Week')}
          </button>
        </div>

        {/* Messages Container */}
        <div id="ai-chat-messages" className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 theme-bg">
          {messages.length >= 200 && <button type="button" className="text-xs underline" onClick={() => { const id=chatIdRef.current; if(id)void chatMessages(id,messages[0]).then(older=>setMessages(current=>[...older,...current])).catch(()=>setHistoryError(true)); }}>{ui.older}</button>}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isAdded = addedEventsIds.includes(msg.id);
            const plan = msg.suggestedPlan || (msg.suggestedEvent ? { kind: 'create' as const, events: [msg.suggestedEvent], originals: [] } : undefined);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-xs ${
                    isUser
                      ? 'theme-primary bg-blue-600 text-white rounded-tr-xs'
                      : 'theme-surface theme-text theme-border border rounded-tl-xs'
                  }`}
                >
                  {/* Markdown Renderer */}
                  <MarkdownMessage content={msg.content} isUser={isUser} />
                  {msg.proposalSummary && <p className="mt-2 whitespace-pre-wrap theme-muted">{msg.proposalSummary}</p>}

                  {plan && (
                    <div className="mt-3 p-3 theme-subtle rounded-xl theme-border border theme-text space-y-3 text-xs">
                      <p className="font-semibold">{plan.kind === 'delete' ? modelText.deletion : plan.kind === 'move' ? modelText.edit : (tr(language, 'Propozycje wydarzeń', 'Proposed events'))}</p>
                      {plan.events.map((draft, index) => (
                        <div key={index} className="space-y-1 theme-border border-b pb-2">
                          <p className="font-semibold">{draft.title}</p>
                          {plan.originals[index] && <p className="theme-muted">{tr(language, 'Przed:', 'Before:')} {plan.originals[index].startDate} {plan.originals[index].startTime} – {plan.originals[index].endDate} {plan.originals[index].endTime}</p>}
                          <p>{plan.kind === 'move' ? (tr(language, 'Po:', 'After:')) : ''} {draft.startDate} {draft.startTime || (tr(language, 'Cały dzień', 'All day'))} – {draft.endDate} {draft.endTime}</p>
                          {draft.location && <p>{tr(language, 'Miejsce:', 'Location:')} {draft.location}</p>}
                          {draft.recurrence && draft.recurrence !== 'NONE' && <p>{tr(language, 'Powtarzanie:', 'Repeats:')} {({ DAILY: tr(language, 'codziennie', 'daily'), WEEKLY: tr(language, 'co tydzień', 'weekly'), MONTHLY: tr(language, 'co miesiąc', 'monthly') } as Record<string, string>)[draft.recurrence] || draft.recurrence}</p>}
                        </div>
                      ))}
                      {isAdded ? <p role="status">{tr(language, 'Zapisano zmiany.', 'Changes saved.')}</p> : <button type="button" id={`btn-confirm-ai-event-${msg.id}`} disabled={isProcessing || !aiSettings.enabled} onClick={() => handleConfirm(msg.id, plan)} className="w-full py-2 px-3 theme-primary bg-blue-600 text-white rounded-xl disabled:opacity-50">
                        {plan.kind === 'delete' ? modelText.delete : tr(language, 'Zatwierdź wszystkie zmiany', 'Confirm all changes')}
                      </button>}
                    </div>
                  )}
                </div>

                {/* Dynamic Quick Prompt Suggestions */}
                {!isUser &&
                  msg.suggestedPrompts &&
                  msg.suggestedPrompts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pl-1 max-w-[90%]">
                      {msg.suggestedPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-[11px] px-2.5 py-1 rounded-full theme-surface theme-hover theme-text theme-border border transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <span className="text-violet-400">↳</span>
                          <span>{prompt}</span>
                        </button>
                      ))}
                    </div>
                  )}

                <span className="text-[10px] theme-muted mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {msg.role === 'assistant' && msg.route === 'model' && msg.modelId ? ` · ${findModel(msg.modelId).name}` : ''}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 shrink-0 theme-surface theme-border border-t flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={
              tr(language, 'Napisz np. Trening jutro o 18 na 1h...', 'Type e.g. Workout tomorrow at 6pm for 1h...')
            }
            disabled={isProcessing || !aiSettings.enabled || !historyReady}
            maxLength={1000}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            id="btn-send-ai-message"
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isProcessing || !aiSettings.enabled || !historyReady}
            className="p-2.5 theme-primary bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      {historyOpen && <div className="absolute inset-y-0 right-0 w-full max-w-md"><ChatHistoryPanel language={language} onClose={closeHistory} onSelect={id => { void selectChat(id); }} onNew={handleClearChat} onDeleted={id => { if (!id || id === chatIdRef.current) void startNewChat(); }}/></div>}
      {settingsOpen && <AiSettingsPanel language={language} enabled={aiSettings.enabled} onClose={closeSettings}/>}
    </Dialog>
  );
};
