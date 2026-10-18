import React, { useMemo, useState, useDeferredValue, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CalendarEvent } from '../types';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import { Dialog } from './Dialog';
interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  language?: AppLanguage;
}
export function SearchModal({
  onClose,
  events,
  onSelectEvent,
  language = 'pl',
}: Props) {
  const t = getTranslation(language),
    [query, setQuery] = useState(''),
    deferred = useDeferredValue(query);
  const searchable = useMemo(
    () =>
      [...events]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((event) => ({
          event,
          text: `${event.title}\n${event.description || ''}\n${event.location || ''}`.toLocaleLowerCase(),
        })),
    [events],
  );
  const results = useMemo(() => {
    const q = deferred.trim().toLocaleLowerCase();
    return q
      ? searchable.filter((row) => row.text.includes(q)).map((row) => row.event)
      : [];
  }, [searchable, deferred]);
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: results.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 76,
    overscan: 5,
    getItemKey: (i) => results[i].id,
  });
  return (
    <Dialog
      onClose={onClose}
      label={t.search}
      className="fixed inset-0 z-50 bg-black/60 p-3 pt-12 flex justify-center items-start"
    >
      <div
        id="modal-search"
        className="w-full max-w-lg theme-surface rounded-2xl p-3"
      >
        <div className="flex gap-2">
          <input
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            data-autofocus="true"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              parent.current?.scrollTo(0, 0);
            }}
            className="theme-input min-w-0 flex-1 p-2 rounded-lg"
          />
          <button onClick={onClose} className="text-xs p-2">
            {t.close}
          </button>
        </div>
        <p className="text-xs theme-muted p-2" role="status">
          {query
            ? `${results.length} ${language === 'pl' ? 'wyników' : 'results'}`
            : t.searchPlaceholder}
        </p>
        <div
          ref={parent}
          className="h-[60dvh] overflow-auto"
          aria-busy={query !== deferred}
        >
          <div className="relative" style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((row) => {
              const event = results[row.index];
              return (
                <button
                  key={row.key}
                  data-index={row.index}
                  ref={virtual.measureElement}
                  onClick={() => onSelectEvent(event)}
                  className="absolute left-0 w-full text-left p-3 border-b theme-border theme-hover"
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  <span className="block font-semibold truncate">
                    {event.title}
                  </span>
                  <span className="block text-xs theme-muted">
                    {event.startDate} {event.startTime} {event.location}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
