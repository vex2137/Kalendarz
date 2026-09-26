import React, { useState, useMemo } from 'react';
import { CalendarEvent, GoogleCalendarColor } from '../types';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';
import { 
  Search, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Filter,
  ArrowRight
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<GoogleCalendarColor | 'ALL'>('ALL');
  const [timeScope, setTimeScope] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Filter by text query
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((e) => {
        const titleMatch = e.title.toLowerCase().includes(query);
        const locMatch = e.location ? e.location.toLowerCase().includes(query) : false;
        const descMatch = e.description ? e.description.toLowerCase().includes(query) : false;
        const dateMatch = e.startDate.includes(query);
        return titleMatch || locMatch || descMatch || dateMatch;
      });
    }

    // Filter by color
    if (selectedColor !== 'ALL') {
      result = result.filter((e) => e.color === selectedColor);
    }

    // Filter by time scope
    if (timeScope === 'UPCOMING') {
      result = result.filter((e) => e.startDate >= todayStr);
    } else if (timeScope === 'PAST') {
      result = result.filter((e) => e.startDate < todayStr);
    }

    // Sort by date ascending
    return result.sort((a, b) => {
      const cmp = a.startDate.localeCompare(b.startDate);
      if (cmp !== 0) return cmp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }, [events, searchQuery, selectedColor, timeScope, todayStr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div 
        id="modal-search"
        className="theme-surface theme-text rounded-3xl max-w-2xl w-full shadow-2xl theme-border border overflow-hidden flex flex-col my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="p-4 theme-border border-b flex items-center gap-3 theme-subtle">
          <Search className="w-5 h-5 theme-muted shrink-0" />
          <input
            type="text"
            placeholder="Szukaj wydarzenia po tytule, miejscu, opisie lub dacie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm sm:text-base font-medium theme-text placeholder:theme-muted outline-hidden"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg theme-muted hover:theme-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills Bar */}
        <div className="px-4 py-2.5 theme-subtle theme-border border-b flex items-center justify-between gap-2 overflow-x-auto text-xs">
          {/* Time Scope selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] theme-muted mr-1 font-semibold">Czas:</span>
            <button
              onClick={() => setTimeScope('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeScope === 'ALL' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'theme-muted theme-hover'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setTimeScope('UPCOMING')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeScope === 'UPCOMING' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'theme-muted theme-hover'
              }`}
            >
              Nadchodzące
            </button>
            <button
              onClick={() => setTimeScope('PAST')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeScope === 'PAST' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'theme-muted theme-hover'
              }`}
            >
              Przeszłe
            </button>
          </div>

          {/* Color filter */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] theme-muted mr-1 font-semibold">Kolor:</span>
            <button
              onClick={() => setSelectedColor('ALL')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                selectedColor === 'ALL' ? 'theme-surface font-bold theme-text theme-border border shadow-2xs' : 'theme-muted'
              }`}
            >
              Każdy
            </button>
            {(['tomato', 'sage', 'blueberry', 'flamingo', 'tangerine', 'banana'] as GoogleCalendarColor[]).map((cKey) => (
              <button
                key={cKey}
                onClick={() => setSelectedColor(selectedColor === cKey ? 'ALL' : cKey)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  selectedColor === cKey ? 'scale-120 ring-2 ring-white shadow-xs' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[cKey].dot }}
                title={GOOGLE_CALENDAR_COLORS[cKey].name}
              />
            ))}
          </div>
        </div>

        {/* Results count info */}
        <div className="px-4 py-2 text-[11px] theme-muted flex items-center justify-between theme-border border-b">
          <span>Znaleziono: <strong>{filteredEvents.length}</strong> wydarzeń</span>
          {searchQuery && <span>Filtrowanie: „{searchQuery}”</span>}
        </div>

        {/* Event Results List */}
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[60vh] space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CalendarIcon className="w-10 h-10 theme-muted opacity-40 mx-auto" />
              <p className="text-sm font-semibold theme-text">Brak pasujących wydarzeń</p>
              <p className="text-xs theme-muted">Spróbuj zmienić zapytanie lub filtry.</p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const colorDef = GOOGLE_CALENDAR_COLORS[ev.color || 'peacock'];

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    onSelectEvent(ev);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl theme-subtle theme-hover theme-border border transition-all cursor-pointer group shadow-2xs"
                >
                  {/* Color stripe */}
                  <div
                    className="w-2.5 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: colorDef.dot }}
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold theme-text group-hover:text-blue-500 transition-colors truncate">
                        {ev.title}
                      </h4>
                      {ev.recurrence && ev.recurrence !== 'NONE' && (
                        <span className="text-[10px] theme-muted bg-stone-500/10 px-1.5 py-0.5 rounded font-medium">
                          cykliczne
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] theme-muted mt-1">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3 opacity-70" />
                        <span className="font-semibold">{ev.startDate}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-70" />
                        <span>{ev.allDay ? 'Cały dzień' : `${ev.startTime} – ${ev.endTime}`}</span>
                      </div>

                      {ev.location && (
                        <div className="flex items-center gap-1 truncate max-w-[180px]">
                          <MapPin className="w-3 h-3 opacity-70 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 theme-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 theme-subtle theme-border border-t flex items-center justify-between text-xs theme-muted">
          <span>Wskazówka: Kliknij wydarzenie, aby je otworzyć i edytować.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl theme-surface theme-hover theme-text font-semibold theme-border border"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
