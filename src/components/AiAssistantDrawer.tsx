import { tr } from '../utils/i18n';
import type { AssistantPlan } from '../utils/assistantPlanning';
import { planningPreferences } from '../utils/assistantPlanning';
import { Dialog } from './Dialog';
import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { CalendarEvent, AiChatMessage, AiSettings } from '../types';
import { runModelAssistant, type ModelConversation } from '../utils/modelAssistant';
import { cancelModelOperation, modelStatus, subscribeModel, setAssistantActive } from '../utils/localModelRuntime';
import { ModelDiagnostics } from './ModelDiagnostics';
import { localModelText } from '../utils/localModelText';
import { LocalModelSetup } from './LocalModelSetup';
import { detectAssistantLanguage } from '../utils/assistantLanguage';
import { recordAssistantUiCommit, observeAssistantSession, markAssistantInputReady } from '../utils/modelDiagnostics';
import { assistantUiText } from '../utils/assistantUiText';
import { findModel } from '../utils/modelRegistry';
import { chatMessages, createChat, getChat, rememberChat, resolveActiveChat, saveChat } from '../utils/chatHistory';
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
    if (isOpen) {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    } catch {
      const next: AiChatMessage[] = [
        ...withUser,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            model.installed ? localModelText(detectAssistantLanguage(text, conversationRef.current.language || language)).inputError : assistantUiText(detectAssistantLanguage(text, conversationRef.current.language || language)).modelMissing,
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
      const chat = await createChat(ui.newChat, model.modelId);
      chatIdRef.current = chat.id; conversationRef.current = {};
      setMessages([{ ...defaultMsg, timestamp: Date.now() }]); setAddedEventsIds([]);
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
      setMessages(stored.length ? stored : [defaultMsg]); setAddedEventsIds([]); setHistoryOpen(false);
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

  if (historyOpen) return <Dialog onClose={() => setHistoryOpen(false)} label={ui.conversations} className="fixed inset-0 z-50 bg-black/60 flex justify-end">
    <div className="w-full max-w-md h-full"><ChatHistoryPanel language={language} onClose={() => setHistoryOpen(false)} onSelect={id => { void selectChat(id); }} onNew={handleClearChat} onDeleted={id => { if (!id || id === chatIdRef.current) void startNewChat(); }}/></div>
  </Dialog>;
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
      onClose={onClose}
      label={t.aiAssistantTitle}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
    >
      <div
        id="drawer-ai-assistant"
        className="theme-surface w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 theme-border border-l"
      >
        {/* Header */}
        <div className="px-4 py-3 theme-border border-b theme-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold theme-text">
                  {t.aiAssistantTitle}
                </h3>
                <span className="text-[10px] bg-violet-500/20 text-violet-400 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Offline
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] theme-muted">
                <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>{findModel(model.modelId).name} · offline</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" id="btn-ai-chat-history" aria-label={ui.conversations} title={ui.conversations} disabled={isProcessing || !historyReady} onClick={() => setHistoryOpen(true)} className="p-1.5 theme-muted"><History className="w-4 h-4"/></button>
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              id="btn-new-ai-chat"
              title={ui.newChat}
              aria-label={ui.newChat}
              disabled={isProcessing || !aiSettings.enabled}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="btn-close-ai-drawer"
              aria-label={t.close}
              onClick={onClose}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title={tr(language, 'Zamknij asystenta', 'Close assistant')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <LocalModelSetup language={language} enabled={aiSettings.enabled} />
        <ModelDiagnostics language={language} enabled={aiSettings.enabled} />
        {historyError && <p role="alert" className="p-2 text-xs">{ui.historyError}</p>}
        {isProcessing && <div role="status" className="p-2 text-xs flex justify-between gap-2"><span>{model.phase === 'running' ? ui.generating : modelText[model.phase]}</span><button type="button" id="btn-stop-ai-generation" className="underline" onClick={cancelModelOperation}>{ui.cancel}</button></div>}

        {canUndo && <button id="btn-undo-ai" type="button" onClick={handleUndo} disabled={isProcessing || !aiSettings.enabled} className="m-2 px-3 py-2 rounded theme-surface theme-text theme-border border text-sm">
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 theme-bg">
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
    </Dialog>
  );
};
