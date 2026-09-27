import React from 'react';
import { CalendarEvent } from '../types';
import { Bell, X, Calendar, Clock } from 'lucide-react';

interface NotificationBannerProps {
  activeNotification: {
    event: CalendarEvent;
    minutesBefore: number;
  } | null;
  onDismiss: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  activeNotification,
  onDismiss,
  onOpenEvent,
}) => {
  if (!activeNotification) return null;

  const { event, minutesBefore } = activeNotification;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="p-4 rounded-3xl bg-neutral-900 border border-blue-500/50 shadow-2xl text-white flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-xs">
          <Bell className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              {minutesBefore === 0 ? 'Wydarzenie teraz' : `Przypomnienie za ${minutesBefore} min`}
            </span>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h4 className="font-bold text-sm text-white truncate pt-0.5">{event.title}</h4>

          <div className="flex items-center gap-3 text-xs text-neutral-400 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {event.startDate}
            </span>
            {event.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {event.startTime} - {event.endTime}
              </span>
            )}
          </div>

          <div className="pt-2.5 flex items-center gap-2">
            <button
              onClick={() => {
                onOpenEvent(event);
                onDismiss();
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Pokaż szczegóły
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
            >
              Odrzuć
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
