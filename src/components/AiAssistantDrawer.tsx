import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarEvent, 
  AiChatMessage, 
  AiSettings 
} from '../types';
import { runLocalAiAssistant } from '../utils/aiEngine';
import { MarkdownMessage } from './MarkdownMessage';
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
}

const DEFAULT_WELCOME_MSG: AiChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content: 'Dzień dobry! 👋 Jestem Twoim lokalnym asystentem kalendarza (100% Offline).\n\nPracuję bezpośrednio na Twoim urządzeniu z zerową telemetrią. Oto co potrafię:\n• **Odpowiedzieć na pytania** o grafik i wolny czas na dowolny dzień\n• **Sprawdzić wolne okienka** (np. *„Czy mam wolny czwartek?”*)\n• **Wykryć kolizje terminów** i nakładające się spotkania\n• **Dodać nowe wydarzenie** ze zdania po polsku (np. *„Trening jutro o 18 na godzinę”*)\n\nW czym mogę Ci pomóc?',
  timestamp: Date.now(),
  suggestedPrompts: [
    'Co mam dzisiaj w planie?',
    'Kiedy mam wolne dzisiaj?',
    'Czy mam wolny czwartek?',
    'Sprawdź kolizje terminów',
  ],
};

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onAddEventFromAi,
  aiSettings,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([DEFAULT_WELCOME_MSG]);
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
      const response = await runLocalAiAssistant(text, events);
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
          content: 'Wystąpił błąd lokalnego asystenta. Spróbuj zadać pytanie inaczej.',
          timestamp: Date.now(),
          suggestedPrompts: ['Co mam dzisiaj w planie?', 'Kiedy mam wolne dzisiaj?'],
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME_MSG]);
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
                <h3 className="text-sm font-bold theme-text">Asystent Kalendarza</h3>
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
            onClick={() => handleSendMessage('Kiedy mam wolne dzisiaj?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🔍</span> Wolny czas dzisiaj
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Co mam zaplanowane na dzisiaj?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📅</span> Mój plan
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Czy mam wolny czwartek?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>🗓️</span> Wolny czwartek?
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Czy mam jakieś kolizje w terminach?')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>⚠️</span> Kolizje
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Podsumuj mój nadchodzący tydzień')}
            className="whitespace-nowrap px-2.5 py-1 theme-surface theme-hover theme-text rounded-lg theme-border border transition-colors shadow-2xs shrink-0 flex items-center gap-1"
          >
            <span>📊</span> Tydzień
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
                  {/* Markdown Renderer: renders bold, italics, bullets and quotes nicely */}
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
                          {msg.suggestedEvent.startTime ? `, ${msg.suggestedEvent.startTime} – ${msg.suggestedEvent.endTime}` : ' (Cały dzień)'}
                        </span>
                      </div>

                      {msg.suggestedEvent.location && (
                        <div className="theme-muted">
                          Lokalizacja: <span className="font-medium theme-text">{msg.suggestedEvent.location}</span>
                        </div>
                      )}

                      <div className="pt-1">
                        {isAdded ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold py-1">
                            <Check className="w-4 h-4" />
                            <span>Dodano do Twojego kalendarza!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-confirm-ai-event-${msg.id}`}
                            onClick={() => handleConfirmAdd(msg.id, msg.suggestedEvent!)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>Zatwierdź i dodaj do kalendarza</span>
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

          {isProcessing && (
            <div className="flex items-center gap-2 p-3 theme-surface rounded-2xl theme-border border text-xs theme-text w-fit animate-pulse">
              <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
              <span>Analizuję zapytanie i Twój grafik...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 theme-border border-t theme-surface">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              id="input-ai-chat"
              type="text"
              placeholder="Zapytaj np. „Czy mam wolny czwartek?” lub dodaj wydarzenie..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isProcessing || !aiSettings.enabled}
              className="flex-1 px-3.5 py-2.5 rounded-xl theme-input text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isProcessing || !aiSettings.enabled}
              className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors shrink-0 shadow-xs flex items-center justify-center cursor-pointer"
              title="Wyślij do asystenta"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] theme-muted mt-2 px-1">
            <span>Silnik: 100% Offline NLP (Na urządzeniu)</span>
            <span>Bez połączenia z siecią</span>
          </div>
        </div>
      </div>
    </div>
  );
};
