import React from 'react';
import { CalendarEvent } from '../types';
import { Bell, X } from 'lucide-react';
import { GOOGLE_CALENDAR_COLORS } from '../utils/constants';

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
  const colorDef = GOOGLE_CALENDAR_COLORS[event.color] || GOOGLE_CALENDAR_COLORS.peacock;

  const reminderText = minutesBefore === 0 
    ? 'Właśnie teraz!' 
    : minutesBefore < 60 
    ? `Za ${minutesBefore} min` 
    : `Za ${Math.floor(minutesBefore / 60)} godz.`;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div 
        id="toast-notification-reminder"
        onClick={() => {
          onOpenEvent(event);
          onDismiss();
        }}
        className="bg-white rounded-2xl p-4 shadow-xl border-2 border-blue-500 flex items-start gap-3 cursor-pointer hover:bg-blue-50/20 transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 animate-bounce">
          <Bell className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">
              {reminderText}
            </span>
            <span className="text-xs text-stone-500">{event.startTime || 'Cały dzień'}</span>
          </div>

          <h4 className="text-sm font-semibold text-stone-900 mt-1 truncate">
            {event.title}
          </h4>

          {event.location && (
            <p className="text-xs text-stone-600 truncate mt-0.5">
              {event.location}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
