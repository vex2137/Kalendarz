import React, { useState, useEffect } from 'react';
import { 
  CalendarEvent, 
  GoogleCalendarColor, 
  RecurrenceFreq 
} from '../types';
import { GOOGLE_CALENDAR_COLORS, STANDARD_REMINDER_OPTIONS } from '../utils/constants';
import { 
  X, 
  Clock, 
  MapPin, 
  AlignLeft, 
  Bell, 
  Repeat, 
  Trash2, 
  Palette,
  Plus
} from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  eventToEdit?: CalendarEvent | null;
  initialDate?: string;
  initialTime?: string;
  defaultColor?: GoogleCalendarColor;
  defaultReminder?: number;
  defaultDuration?: number;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  eventToEdit,
  initialDate,
  initialTime,
  defaultColor = 'peacock',
  defaultReminder = 15,
  defaultDuration = 60,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('11:00');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<GoogleCalendarColor>(defaultColor);
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>('NONE');
  const [reminders, setReminders] = useState<number[]>([defaultReminder]);
  const [customReminderVal, setCustomReminderVal] = useState<string>('');
  const [showCustomReminderInput, setShowCustomReminderInput] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setStartDate(eventToEdit.startDate);
      setStartTime(eventToEdit.startTime || '10:00');
      setEndDate(eventToEdit.endDate || eventToEdit.startDate);
      setEndTime(eventToEdit.endTime || '11:00');
      setAllDay(eventToEdit.allDay);
      setLocation(eventToEdit.location || '');
      setDescription(eventToEdit.description || '');
      setColor(eventToEdit.color);
      setRecurrence(eventToEdit.recurrence || 'NONE');
      setReminders(eventToEdit.reminders || [defaultReminder]);
    } else {
      const todayStr = initialDate || new Date().toISOString().split('T')[0];
      const startT = initialTime || '10:00';

      // calculate end time with defaultDuration
      const [h, m] = startT.split(':').map(Number);
      const totalMinutes = h * 60 + m + (defaultDuration || 60);
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const endT = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      setTitle('');
      setStartDate(todayStr);
      setStartTime(startT);
      setEndDate(todayStr);
      setEndTime(endT);
      setAllDay(false);
      setLocation('');
      setDescription('');
      setColor(defaultColor);
      setRecurrence('NONE');
      setReminders(defaultReminder > 0 ? [defaultReminder] : []);
    }
    setShowCustomReminderInput(false);
  }, [isOpen, eventToEdit, initialDate, initialTime, defaultColor, defaultReminder, defaultDuration]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    const eventPayload: CalendarEvent = {
      id: eventToEdit ? eventToEdit.id : `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      startDate,
      startTime: allDay ? undefined : startTime,
      endDate: endDate || startDate,
      endTime: allDay ? undefined : endTime,
      allDay,
      color,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      reminders,
      recurrence,
      createdAt: eventToEdit ? eventToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(eventPayload);
    onClose();
  };

  const handleAddCustomReminder = () => {
    const minutes = parseInt(customReminderVal, 10);
    if (!isNaN(minutes) && minutes >= 0 && !reminders.includes(minutes)) {
      setReminders([...reminders, minutes].sort((a, b) => a - b));
      setCustomReminderVal('');
      setShowCustomReminderInput(false);
    }
  };

  const handleRemoveReminder = (minuteToRemove: number) => {
    setReminders(reminders.filter((m) => m !== minuteToRemove));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="modal-event-form"
        className="theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 theme-border border-b theme-subtle">
          <div className="flex items-center gap-2">
            <div 
              className="w-3.5 h-3.5 rounded-full ring-2 ring-black/20" 
              style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[color].dot }} 
            />
            <h3 className="text-sm font-bold theme-text">
              {eventToEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {eventToEdit && onDelete && (
              <button
                type="button"
                id="btn-delete-event"
                onClick={() => {
                  if (confirm('Czy na pewno chcesz usunąć to wydarzenie z kalendarza?')) {
                    onDelete(eventToEdit.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Usuń wydarzenie"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-close-event-modal"
              onClick={onClose}
              className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Title input */}
          <div>
            <input
              id="input-event-title"
              type="text"
              required
              placeholder="Dodaj tytuł wydarzenia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base sm:text-lg font-bold border-b-2 theme-border focus:border-blue-500 outline-hidden pb-1.5 bg-transparent theme-text placeholder:theme-muted"
              autoFocus
            />
          </div>

          {/* Date & Time Row */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold theme-text">
                <Clock className="w-4 h-4 theme-muted" />
                <span>Termin i czas trwania</span>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer theme-muted select-none">
                <input
                  id="checkbox-all-day"
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded-sm accent-blue-600 focus:ring-blue-500"
                />
                <span>Cały dzień</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] theme-muted">Początek</label>
                <input
                  id="input-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {!allDay && (
                  <input
                    id="input-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] theme-muted">Koniec</label>
                <input
                  id="input-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {!allDay && (
                  <input
                    id="input-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Recurrence Selection */}
          <div className="flex items-center gap-3 pt-1 text-xs">
            <Repeat className="w-4 h-4 theme-muted shrink-0" />
            <div className="flex-1">
              <select
                id="select-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceFreq)}
                className="w-full px-2.5 py-1.5 rounded-xl theme-input text-xs focus:outline-none"
              >
                <option value="NONE">Nie powtarza się</option>
                <option value="DAILY">Codziennie</option>
                <option value="WEEKLY">Co tydzień</option>
                <option value="MONTHLY">Co miesiąc</option>
                <option value="YEARLY">Co rok</option>
              </select>
            </div>
          </div>

          {/* Color Palette (11 Google Calendar Colors) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold theme-text">
              <Palette className="w-4 h-4 theme-muted" />
              <span>Kolor: </span>
              <span className="font-bold">{GOOGLE_CALENDAR_COLORS[color].name}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.values(GOOGLE_CALENDAR_COLORS).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  id={`color-choice-${c.id}`}
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                    color === c.id ? 'ring-2 ring-white scale-115 shadow-xs' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.dot }}
                  title={c.name}
                >
                  {color === c.id && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                </button>
              ))}
            </div>
          </div>

          {/* Reminders / Push Notifications */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold theme-text">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 theme-muted" />
                <span>Powiadomienia</span>
              </div>
              <button
                type="button"
                id="btn-add-reminder"
                onClick={() => setShowCustomReminderInput(true)}
                className="text-blue-500 hover:text-blue-400 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj alert
              </button>
            </div>

            {/* Existing reminders tags */}
            <div className="flex flex-wrap gap-1.5">
              {reminders.map((min) => {
                const standardOpt = STANDARD_REMINDER_OPTIONS.find((o) => o.value === min);
                const label = standardOpt ? standardOpt.label : `${min} min wcześniej`;

                return (
                  <span
                    key={min}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl theme-subtle theme-border border theme-text text-xs"
                  >
                    <span>{label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(min)}
                      className="theme-muted hover:theme-text ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Custom reminder input popover */}
            {showCustomReminderInput && (
              <div className="flex items-center gap-2 p-2 theme-subtle rounded-xl theme-border border mt-2">
                <select
                  id="select-standard-reminder"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!reminders.includes(v)) {
                      setReminders([...reminders, v].sort((a, b) => a - b));
                    }
                    setShowCustomReminderInput(false);
                  }}
                  className="flex-1 px-2 py-1 text-xs rounded-lg theme-input"
                  defaultValue=""
                >
                  <option value="" disabled>Wybierz typowy czas...</option>
                  {STANDARD_REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <span className="text-xs theme-muted">lub</span>

                <div className="flex items-center gap-1">
                  <input
                    id="input-custom-minutes"
                    type="number"
                    min="1"
                    placeholder="Minuty"
                    value={customReminderVal}
                    onChange={(e) => setCustomReminderVal(e.target.value)}
                    className="w-20 px-2 py-1 text-xs rounded-lg theme-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomReminder}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Location Input */}
          <div className="flex items-center gap-3 pt-1 text-xs">
            <MapPin className="w-4 h-4 theme-muted shrink-0" />
            <input
              id="input-event-location"
              type="text"
              placeholder="Lokalizacja (np. Gabinet, Biuro, Park)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-xl theme-input text-xs"
            />
          </div>

          {/* Description Input */}
          <div className="flex items-start gap-3 pt-1 text-xs">
            <AlignLeft className="w-4 h-4 theme-muted shrink-0 mt-2" />
            <textarea
              id="input-event-description"
              rows={3}
              placeholder="Notatki lub opis spotkania..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-xl theme-input text-xs resize-none"
            />
          </div>

          {/* Actions Bottom Bar */}
          <div className="pt-3 theme-border border-t flex items-center justify-end gap-2">
            <button
              type="button"
              id="btn-cancel-event-form"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium theme-muted hover:theme-text rounded-xl theme-hover transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              id="btn-save-event-form"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
            >
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
