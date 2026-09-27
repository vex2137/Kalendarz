import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { Search, X, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  events,
  onSelectEvent,
}) => {
  const [query, setQuery] = useState('');

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q))
    ).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        id="modal-search"
        className="theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 theme-border border-b flex items-center gap-3">
          <Search className="w-5 h-5 theme-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj wydarzeń, osób, miejsc..."
            autoFocus
            className="flex-1 bg-transparent text-sm sm:text-base font-medium theme-text focus:outline-none placeholder:text-stone-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg theme-muted hover:theme-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold theme-subtle theme-hover theme-text rounded-xl theme-border border transition-colors"
          >
            Zamknij
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto max-h-[60vh] space-y-2">
          {!query.trim() ? (
            <div className="p-8 text-center text-xs theme-muted">
              Wpisz frazę, aby wyszukać wydarzenia w kalendarzu.
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs theme-muted">
              Brak wyników dla „{query}”.
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const colorDef = GOOGLE_CALENDAR_COLORS[ev.color || 'peacock'];
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    onSelectEvent(ev);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-2xl theme-subtle theme-hover theme-border border transition-all flex items-start gap-3 group"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: colorDef.dot }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold theme-text truncate group-hover:text-blue-500 transition-colors">
                      {ev.title}
                    </h4>
                    <div className="flex items-center gap-3 text-[11px] theme-muted mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
                        {ev.startDate}
                      </span>
                      {!ev.allDay && ev.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          {ev.startTime} – {ev.endTime}
                        </span>
                      )}
                      {ev.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 opacity-70" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
