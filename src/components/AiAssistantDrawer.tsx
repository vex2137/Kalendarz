import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarEvent, 
  AiChatMessage, 
  AiSettings 
} from '../types';
import { runLocalAiAssistant } from '../utils/aiEngine';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { 
  X, 
  Sparkles, 
  Send, 
  Cpu, 
  CalendarPlus, 
  Check, 
  Clock, 
  AlertCircle,
  HelpCircle,
  Wand2
} from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onAddEventFromAi: (eventData: Partial<CalendarEvent>) => void;
  aiSettings: AiSettings;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onAddEventFromAi,
  aiSettings,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: 'Cześć! Jestem Twoim lokalnym asystentem AI kalendarza. Przetwarzam wszystkie polecenia **w 100% offline na Twoim telefonie** (Gemma 2 2B / Offline NLP) z zerową telemetrią.\n\nNapisz np.:\n- *„Jutro o 15:30 dentysta na 45 minut”*\n- *„Kiedy mam wolne dzisiaj?”*\n- *„Podsumuj mój nadchodzący tydzień”*',
      timestamp: Date.now(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedEventsIds, setAddedEventsIds] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: 'Wystąpił błąd lokalnego silnika AI. Upewnij się, że opcja AI jest aktywna w ustawieniach.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAdd = (msgId: string, eventSuggestion: Partial<CalendarEvent>) => {
    onAddEventFromAi(eventSuggestion);
    setAddedEventsIds((prev) => [...prev, msgId]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
      <div 
        id="drawer-ai-assistant"
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 border-l border-stone-200"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-stone-200 bg-violet-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-stone-900">Lokalne AI Kalendarza</h3>
                <span className="text-[10px] bg-violet-200 text-violet-900 font-bold px-1.5 py-0.2 rounded-md uppercase">
                  Gemma 2 2B
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-stone-700">
                <Cpu className="w-3 h-3 text-emerald-600" />
                <span>Przetwarzanie na telefonie • 0 telemetrii</span>
              </div>
            </div>
          </div>
          <button
            id="btn-close-ai-drawer"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-700 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status indicator if AI is disabled */}
        {!aiSettings.enabled && (
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>AI jest obecnie wyłączone w opcjach. Przejdź do Ustawień, aby je aktywować.</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <button
            type="button"
            onClick={() => handleSendMessage('Kiedy mam wolne dzisiaj?')}
            className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 transition-colors"
          >
            Wolny czas dzisiaj
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Jutro o 15:30 dentysta na 45 minut')}
            className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 transition-colors"
          >
            + Dentysta jutro 15:30
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage('Czy mam jakieś konflikty w terminach?')}
            className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 transition-colors"
          >
            Sprawdź kolizje
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/40">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isAdded = addedEventsIds.includes(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>

                  {/* If assistant extracted an event suggestion */}
                  {msg.suggestedEvent && (
                    <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-900 space-y-2 text-xs">
                      <div className="font-semibold text-sm text-stone-900 flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-violet-600" />
                        <span>{msg.suggestedEvent.title}</span>
                      </div>

                      <div className="flex items-center gap-2 text-stone-700">
                        <Clock className="w-3.5 h-3.5 text-stone-600" />
                        <span>
                          {msg.suggestedEvent.startDate}
                          {msg.suggestedEvent.startTime ? `, ${msg.suggestedEvent.startTime} - ${msg.suggestedEvent.endTime}` : ' (Cały dzień)'}
                        </span>
                      </div>

                      {msg.suggestedEvent.location && (
                        <div className="text-stone-700">
                          Lokalizacja: <span className="font-medium text-stone-800">{msg.suggestedEvent.location}</span>
                        </div>
                      )}

                      <div className="pt-1">
                        {isAdded ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold py-1">
                            <Check className="w-4 h-4" />
                            <span>Dodano do Twojego kalendarza!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-confirm-ai-event-${msg.id}`}
                            onClick={() => handleConfirmAdd(msg.id, msg.suggestedEvent!)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>Zatwierdź i dodaj</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-stone-600 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-stone-200 text-xs text-stone-700 w-fit">
              <Sparkles className="w-4 h-4 text-violet-600 animate-spin" />
              <span>Gemma 2 (2B) przetwarza lokalnie...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-stone-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              id="input-ai-chat-prompt"
              type="text"
              placeholder="Wpisz np. 'Jutro o 16 basen na 1h'..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isProcessing || !aiSettings.enabled}
              className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-stone-800 placeholder:text-stone-600 text-xs sm:text-sm focus:border-violet-500 outline-hidden transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              id="btn-send-ai-chat"
              disabled={!inputQuery.trim() || isProcessing || !aiSettings.enabled}
              className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors shrink-0 shadow-xs"
              title="Wyślij do lokalnego AI"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-stone-600 mt-2 px-1">
            <span>Model: Gemma 2 2B (On-Device)</span>
            <span>Bez połączenia z siecią</span>
          </div>
        </div>
      </div>
    </div>
  );
};
