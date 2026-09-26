import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarEvent, 
  AiChatMessage, 
  AiSettings 
} from '../types';
import { runLocalAiAssistant } from '../utils/aiEngine';
import { MarkdownMessage } from './MarkdownMessage';
import { getTranslation, AppLanguage } from '../utils/i18n';
import { 
  X, 
  Sparkles, 
  Send, 
  Cpu, 
  CalendarPlus, 
  Check, 
  Clock, 
  AlertCircle,
  Wand2,
  RotateCcw
} from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onAddEventFromAi: (eventData: Partial<CalendarEvent>) => void;
  aiSettings: AiSettings;
  language?: AppLanguage;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onAddEventFromAi,
  aiSettings,
  language = 'pl',
}) => {
  const t = getTranslation(language);

  const defaultMsg: AiChatMessage = {
    id: 'msg-welcome',
    role: 'assistant',
    content: language === 'pl'
      ? 'Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza (100% Offline).\n\nPracuję bezpośrednio na Twoim urządzeniu z zerową telemetrią. Oto co potrafię:\n• **Odpowiedzieć na pytania** o grafik i wolny czas na dowolny dzień\n• **Sprawdzić wolne okienka** (np. *„Czy mam wolny czwartek?”*)\n• **Wykryć kolizje terminów** i nakładające się spotkania\n• **Dodać nowe wydarzenie** ze zdania (np. *„Trening jutro o 18:00 na godzinę”*)\n\nW czym mogę Ci pomóc?'
      : 'Hello! 👋 I am your local calendar assistant (100% Offline).\n\nI run directly on your device with zero telemetry. Here is what I can do:\n• **Answer questions** about your schedule and free time on any day\n• **Check free slots** (e.g. *“Do I have free time on Friday?”*)\n• **Detect schedule conflicts** and overlapping events\n• **Schedule new events** from natural language (e.g. *“Workout tomorrow at 6pm for 1 hour”*)\n\nHow can I help you?',
    timestamp: Date.now(),
    suggestedPrompts: language === 'pl'
      ? ['Co mam dzisiaj w planie?', 'Kiedy mam wolne dzisiaj?', 'Czy mam wolny czwartek?', 'Sprawdź kolizje terminów']
      : ['What is on my schedule today?', 'When do I have free time today?', 'Check for conflicting events', 'Summary of this week'],
  };

  const [messages, setMessages] = useState<AiChatMessage[]>([defaultMsg]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedEventsIds, setAddedEventsIds] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || isProcessing) return;

    const userMessage: AiChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const response = await runLocalAiAssistant(text, events, language);
      const assistantMessage: AiChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        suggestedEvent: response.suggestedEvent,
        suggestedPrompts: response.suggestedPrompts,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: language === 'pl' 
            ? 'Wystąpił błąd lokalnego asystenta. Spróbuj zadać pytanie inaczej.' 
            : 'An error occurred. Try rephrasing your question.',
          timestamp: Date.now(),
          suggestedPrompts: language === 'pl' 
            ? ['Co mam dzisiaj w planie?', 'Kiedy mam wolne dzisiaj?']
            : ['What is on my schedule today?', 'When do I have free time today?'],
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([defaultMsg]);
    setAddedEventsIds([]);
  };

  const handleConfirmAdd = (msgId: string, eventSuggestion: Partial<CalendarEvent>) => {
    onAddEventFromAi(eventSuggestion);
    setAddedEventsIds((prev) => [...prev, msgId]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
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
                <h3 className="text-sm font-bold theme-text">{t.aiAssistantTitle}</h3>
                <span className="text-[10px] bg-violet-500/20 text-violet-400 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Offline
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] theme-muted">
                <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>100% lokalny silnik NLP • zero sieci</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title="Wyczyść rozmowę"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              id="btn-close-ai-drawer"
              onClick={onClose}
              className="p-1.5 rounded-lg theme-muted hover:theme-text theme-hover transition-colors"
              title="Zamknij asystenta"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warning if AI is disabled in settings */}
        {!aiSettings.enabled && (
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Asystent jest obecnie wyłączony w opcjach. Przejdź do Ustawień, aby go włączyć.</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 theme-subtle theme-border border-b flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <button
            type="button"
            onClick={() => handleSendMessage(language === 'pl' ? 'Kiedy mam wolne dzisiaj?' : 'When do I have free time today?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🔍</span> {language === 'pl' ? 'Wolny czas dzisiaj' : 'Free time today'}
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === 'pl' ? 'Co mam zaplanowane na dzisiaj?' : 'What is on for today?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📅</span> {language === 'pl' ? 'Mój plan' : 'My schedule'}
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === 'pl' ? 'Czy mam wolny czwartek?' : 'Am I free on Thursday?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🗓️</span> {language === 'pl' ? 'Wolny czwartek?' : 'Free Thursday?'}
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === 'pl' ? 'Czy mam jakieś kolizje w terminach?' : 'Check for conflicting events')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>⚠️</span> {language === 'pl' ? 'Kolizje' : 'Conflicts'}
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === 'pl' ? 'Podsumuj mój nadchodzący tydzień' : 'Summary of this week')}
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

                  {/* If assistant extracted an event suggestion */}
                  {msg.suggestedEvent && (
                    <div className="mt-3 p-3 theme-subtle rounded-xl theme-border border theme-text space-y-2 text-xs">
                      <div className="font-semibold text-sm theme-text flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>{msg.suggestedEvent.title}</span>
                      </div>

                      <div className="flex items-center gap-2 theme-muted">
                        <Clock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span>
                          {msg.suggestedEvent.startDate}
                          {msg.suggestedEvent.startTime ? `, ${msg.suggestedEvent.startTime} – ${msg.suggestedEvent.endTime}` : (language === 'pl' ? ' (Cały dzień)' : ' (All day)')}
                        </span>
                      </div>

                      {msg.suggestedEvent.location && (
                        <div className="theme-muted">
                          {language === 'pl' ? 'Lokalizacja:' : 'Location:'} <span className="font-medium theme-text">{msg.suggestedEvent.location}</span>
                        </div>
                      )}

                      <div className="pt-1">
                        {isAdded ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold py-1">
                            <Check className="w-4 h-4" />
                            <span>{language === 'pl' ? 'Dodano do Twojego kalendarza!' : 'Added to your calendar!'}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-confirm-ai-event-${msg.id}`}
                            onClick={() => handleConfirmAdd(msg.id, msg.suggestedEvent!)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>{language === 'pl' ? 'Zatwierdź i dodaj do kalendarza' : 'Confirm and add to calendar'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Quick Prompt Suggestions */}
                {!isUser && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
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
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            placeholder={language === 'pl' ? 'Napisz np. Trening jutro o 18 na 1h...' : 'Type e.g. Workout tomorrow at 6pm for 1h...'}
            disabled={isProcessing}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-xl theme-input focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            id="btn-send-ai-message"
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isProcessing}
            className="p-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
