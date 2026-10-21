import type { AssistantPlan } from '../utils/assistantPlanning';
import { planningPreferences } from '../utils/assistantPlanning';
import { Dialog } from './Dialog';
import React, { useState, useRef, useEffect } from 'react';
import { CalendarEvent, AiChatMessage, AiSettings } from '../types';
import { runLocalAiAssistant, type AiConversationContext } from '../utils/aiEngine';
import { MarkdownMessage } from './MarkdownMessage';
import { getTranslation, AppLanguage } from '../utils/i18n';
import {
  X,
  Sparkles,
  Send,
  Cpu,
  AlertCircle,
  RotateCcw,
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

  const defaultMsg: AiChatMessage = {
    id: 'msg-welcome',
    role: 'assistant',
    content:
      language === 'pl'
        ? 'Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza (100% Offline).\n\nPracuję bezpośrednio na Twoim urządzeniu z zerową telemetrią. Oto co potrafię:\n• **Odpowiedzieć na pytania** o grafik i wolny czas na dowolny dzień\n• **Sprawdzić wolne okienka** (np. *„Czy mam wolny czwartek?”*)\n• **Wykryć kolizje terminów** i nakładające się spotkania\n• **Dodać nowe wydarzenie** ze zdania (np. *„Trening jutro o 18:00 na godzinę”*)\n\nMożesz też przenosić zapisane wydarzenia, planować kilka spotkań i cofać ostatnią operację asystenta.\n\nW czym mogę Ci pomóc?'
        : 'Hello! 👋 I am your local calendar assistant (100% Offline).\n\nI run directly on your device with zero telemetry. Here is what I can do:\n• **Answer questions** about your schedule and free time on any day\n• **Check free slots** (e.g. *“Do I have free time on Friday?”*)\n• **Detect schedule conflicts** and overlapping events\n• **Schedule new events** from natural language (e.g. *“Workout tomorrow at 6pm for 1 hour”*)\n\nYou can also reschedule saved events, plan multiple sessions, and undo the last assistant operation.\n\nHow can I help you?',
    timestamp: Date.now(),
    suggestedPrompts:
      language === 'pl'
        ? [
            'Co mam dzisiaj w planie?',
            'Kiedy mam wolne dzisiaj?',
            'Czy mam wolny czwartek?',
            'Sprawdź kolizje terminów',
          ]
        : [
            'What is on my schedule today?',
            'When do I have free time today?',
            'Check for conflicting events',
            'Summary of this week',
          ],
  };

  const [messages, setMessages] = useState<AiChatMessage[]>([defaultMsg]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedEventsIds, setAddedEventsIds] = useState<string[]>([]);
  const operationRef = useRef(false);
  const conversationRef = useRef<AiConversationContext>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    conversationRef.current = {};
    setMessages([defaultMsg]);
    setAddedEventsIds([]);
  }, [language]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || operationRef.current || !aiSettings.enabled) return;
    operationRef.current = true;

    const userMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-199), userMessage]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const response = await runLocalAiAssistant(text, events, language, new Date(), conversationRef.current, planningPreferences(aiSettings.planning));
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
      };
      setMessages((prev) => [...prev.slice(-199), assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            language === 'pl'
              ? 'Wystąpił błąd lokalnego asystenta. Spróbuj zadać pytanie inaczej.'
              : 'An error occurred. Try rephrasing your question.',
          timestamp: Date.now(),
          suggestedPrompts:
            language === 'pl'
              ? ['Co mam dzisiaj w planie?', 'Kiedy mam wolne dzisiaj?']
              : [
                  'What is on my schedule today?',
                  'When do I have free time today?',
                ],
        },
      ]);
    } finally {
      operationRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    conversationRef.current = {};
    setMessages([defaultMsg]);
    setAddedEventsIds([]);
  };

  const handleConfirm = async (msgId: string, plan: AssistantPlan) => {
    if (operationRef.current || !aiSettings.enabled || addedEventsIds.includes(msgId)) return;
    operationRef.current = true;
    try {
      setIsProcessing(true);
      await onApplyPlan(plan);
      conversationRef.current = {};
      setAddedEventsIds(prev => [...prev, msgId]);
    } catch (error) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: String(error), timestamp: Date.now() }]);
    } finally {
      operationRef.current = false;
      setIsProcessing(false);
    }
  };
  const handleUndo = async () => {
    if (operationRef.current || !canUndo) return;
    operationRef.current = true;
    setIsProcessing(true);
    try {
      await onUndo();
      conversationRef.current = {};
      setMessages(prev => [...prev.map(m => ({ ...m, suggestedEvent: undefined, suggestedPlan: undefined })), { id: crypto.randomUUID(), role: 'assistant', content: language === 'pl' ? 'Cofnięto ostatnią operację asystenta.' : 'The last assistant operation was undone.', timestamp: Date.now() }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: String(error), timestamp: Date.now() }]);
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
                <span>{language === 'pl' ? '100% lokalny silnik NLP • zero sieci' : '100% local NLP engine • no network'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title={language === 'pl' ? 'Wyczyść rozmowę' : 'Clear conversation'}
              disabled={isProcessing || !aiSettings.enabled}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="btn-close-ai-drawer"
              aria-label={t.close}
              onClick={onClose}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title={language === 'pl' ? 'Zamknij asystenta' : 'Close assistant'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {canUndo && <button id="btn-undo-ai" type="button" onClick={handleUndo} disabled={isProcessing || !aiSettings.enabled} className="m-2 px-3 py-2 rounded theme-surface theme-text theme-border border text-sm">
          {language === 'pl' ? 'Cofnij ostatnią operację asystenta' : 'Undo last assistant operation'}
        </button>}

        {/* Warning if AI is disabled in settings */}
        {!aiSettings.enabled && (
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {language === 'pl'
                ? 'Asystent jest wyłączony. Włącz go w ustawieniach.'
                : 'The assistant is disabled. Enable it in settings.'}
            </span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 theme-subtle theme-border border-b flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                language === 'pl'
                  ? 'Kiedy mam wolne dzisiaj?'
                  : 'When do I have free time today?',
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🔍</span>{' '}
            {language === 'pl' ? 'Wolny czas dzisiaj' : 'Free time today'}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                language === 'pl'
                  ? 'Co mam zaplanowane na dzisiaj?'
                  : 'What is on for today?',
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📅</span> {language === 'pl' ? 'Mój plan' : 'My schedule'}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                language === 'pl'
                  ? 'Czy mam wolny czwartek?'
                  : 'Am I free on Thursday?',
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🗓️</span>{' '}
            {language === 'pl' ? 'Wolny czwartek?' : 'Free Thursday?'}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                language === 'pl'
                  ? 'Czy mam jakieś kolizje w terminach?'
                  : 'Check for conflicting events',
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>⚠️</span> {language === 'pl' ? 'Kolizje' : 'Conflicts'}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                language === 'pl'
                  ? 'Podsumuj mój nadchodzący tydzień'
                  : 'Summary of this week',
              )
            }
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📊</span> {language === 'pl' ? 'Tydzień' : 'Week'}
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 theme-bg">
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
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'theme-surface theme-text theme-border border rounded-tl-xs'
                  }`}
                >
                  {/* Markdown Renderer */}
                  <MarkdownMessage content={msg.content} isUser={isUser} />

                  {plan && (
                    <div className="mt-3 p-3 theme-subtle rounded-xl theme-border border theme-text space-y-3 text-xs">
                      <p className="font-semibold">{plan.kind === 'move' ? (language === 'pl' ? 'Propozycja zmiany terminu' : 'Proposed reschedule') : (language === 'pl' ? 'Propozycje wydarzeń' : 'Proposed events')}</p>
                      {plan.events.map((draft, index) => (
                        <div key={index} className="space-y-1 theme-border border-b pb-2">
                          <p className="font-semibold">{draft.title}</p>
                          {plan.originals[index] && <p className="theme-muted">{language === 'pl' ? 'Przed:' : 'Before:'} {plan.originals[index].startDate} {plan.originals[index].startTime} – {plan.originals[index].endDate} {plan.originals[index].endTime}</p>}
                          <p>{plan.kind === 'move' ? (language === 'pl' ? 'Po:' : 'After:') : ''} {draft.startDate} {draft.startTime || (language === 'pl' ? 'Cały dzień' : 'All day')} – {draft.endDate} {draft.endTime}</p>
                          {draft.location && <p>{language === 'pl' ? 'Miejsce:' : 'Location:'} {draft.location}</p>}
                          {draft.recurrence && draft.recurrence !== 'NONE' && <p>{language === 'pl' ? 'Powtarzanie:' : 'Repeats:'} {({ DAILY: language === 'pl' ? 'codziennie' : 'daily', WEEKLY: language === 'pl' ? 'co tydzień' : 'weekly', MONTHLY: language === 'pl' ? 'co miesiąc' : 'monthly' } as Record<string, string>)[draft.recurrence] || draft.recurrence}</p>}
                        </div>
                      ))}
                      {isAdded ? <p role="status">{language === 'pl' ? 'Zapisano zmiany.' : 'Changes saved.'}</p> : <button type="button" id={`btn-confirm-ai-event-${msg.id}`} disabled={isProcessing || !aiSettings.enabled} onClick={() => handleConfirm(msg.id, plan)} className="w-full py-2 px-3 bg-blue-600 text-white rounded-xl disabled:opacity-50">
                        {language === 'pl' ? 'Zatwierdź wszystkie zmiany' : 'Confirm all changes'}
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
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 theme-surface theme-border border-t flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={
              language === 'pl'
                ? 'Napisz np. Trening jutro o 18 na 1h...'
                : 'Type e.g. Workout tomorrow at 6pm for 1h...'
            }
            disabled={isProcessing || !aiSettings.enabled}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            id="btn-send-ai-message"
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isProcessing || !aiSettings.enabled}
            className="p-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Dialog>
  );
};
