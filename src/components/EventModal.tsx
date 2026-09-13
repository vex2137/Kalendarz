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
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  eventToEdit,
  initialDate,
  initialTime,
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
  const [color, setColor] = useState<GoogleCalendarColor>('peacock');
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>('NONE');
  const [reminders, setReminders] = useState<number[]>([15]);
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
      setColor(eventToEdit.color || 'peacock');
      setRecurrence(eventToEdit.recurrence || 'NONE');
      setReminders(eventToEdit.reminders?.length ? eventToEdit.reminders : [15]);
    } else {
      const d = initialDate || new Date().toISOString().slice(0, 10);
      setTitle('');
      setStartDate(d);
      setStartTime(initialTime || '10:00');
      setEndDate(d);
      
      // Default 1 hour later
      if (initialTime) {
        const [h, m] = initialTime.split(':').map(Number);
        const nextH = (h + 1) % 24;
        setEndTime(`${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      } else {
        setEndTime('11:00');
      }

      setAllDay(false);
      setLocation('');
      setDescription('');
      setColor('peacock');
      setRecurrence('NONE');
      setReminders([15]);
    }
  }, [isOpen, eventToEdit, initialDate, initialTime]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const eventData: CalendarEvent = {
      id: eventToEdit ? eventToEdit.id : 'ev-' + Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startDate,
      startTime: allDay ? undefined : startTime,
      endDate: endDate || startDate,
      endTime: allDay ? undefined : endTime,
      allDay,
      color,
      recurrence,
      reminders,
      createdAt: eventToEdit?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(eventData);
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        id="modal-event-form"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div 
              className="w-3.5 h-3.5 rounded-full" 
              style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[color].dot }} 
            />
            <h3 className="text-sm font-semibold text-stone-900">
              {eventToEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {eventToEdit && onDelete && (
              <button
                type="button"
                id="btn-delete-event"
                onClick={() => {
                  if (confirm('Czy na pewno chcesz usunąć to wydarzenie z lokalnego kalendarza?')) {
                    onDelete(eventToEdit.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Usuń wydarzenie"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-close-event-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
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
              className="w-full text-base sm:text-lg font-semibold border-b-2 border-stone-200 focus:border-blue-600 outline-hidden pb-1.5 placeholder:text-stone-600 text-stone-900"
              autoFocus
            />
          </div>

          {/* Date & Time Row */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                <Clock className="w-4 h-4 text-stone-600" />
                <span>Termin i czas trwania</span>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-stone-700 select-none">
                <input
                  id="checkbox-all-day"
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Cały dzień</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-700">Początek</label>
                <input
                  id="input-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-900 focus:border-blue-500 outline-hidden"
                />
                {!allDay && (
                  <input
                    id="input-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-900 focus:border-blue-500 outline-hidden mt-1"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-stone-700">Koniec</label>
                <input
                  id="input-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-900 focus:border-blue-500 outline-hidden"
                />
                {!allDay && (
                  <input
                    id="input-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-900 focus:border-blue-500 outline-hidden mt-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Recurrence Selection */}
          <div className="flex items-center gap-3 pt-1 text-xs">
            <Repeat className="w-4 h-4 text-stone-600 shrink-0" />
            <div className="flex-1">
              <select
                id="select-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceFreq)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-800 focus:border-blue-500 outline-hidden text-xs"
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
            <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
              <Palette className="w-4 h-4 text-stone-600" />
              <span>Kolor w kalendarzu: </span>
              <span className="font-semibold text-stone-900">{GOOGLE_CALENDAR_COLORS[color].name}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.values(GOOGLE_CALENDAR_COLORS).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  id={`color-choice-${c.id}`}
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                    color === c.id ? 'ring-2 ring-stone-900 ring-offset-2 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.dot }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Reminders / Push Notifications */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-medium text-stone-700">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-stone-600" />
                <span>Powiadomienia i przypomnienia</span>
              </div>
              <button
                type="button"
                id="btn-add-reminder"
                onClick={() => setShowCustomReminderInput(true)}
                className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj powiadomienie
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 text-xs"
                  >
                    <span>{label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(min)}
                      className="text-stone-600 hover:text-stone-900 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Custom reminder input popover */}
            {showCustomReminderInput && (
              <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-xl border border-stone-200 mt-2">
                <select
                  id="select-standard-reminder"
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!reminders.includes(v)) {
                      setReminders([...reminders, v].sort((a, b) => a - b));
                    }
                    setShowCustomReminderInput(false);
                  }}
                  className="flex-1 px-2 py-1 text-xs rounded-lg border border-stone-300"
                  defaultValue=""
                >
                  <option value="" disabled>Wybierz typowy interwał...</option>
                  {STANDARD_REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <span className="text-xs text-stone-600">lub</span>

                <div className="flex items-center gap-1">
                  <input
                    id="input-custom-minutes"
                    type="number"
                    min="1"
                    placeholder="Minuty"
                    value={customReminderVal}
                    onChange={(e) => setCustomReminderVal(e.target.value)}
                    className="w-20 px-2 py-1 text-xs rounded-lg border border-stone-300"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomReminder}
                    className="px-2.5 py-1 bg-stone-900 text-white rounded-lg text-xs font-medium"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Location Input */}
          <div className="flex items-center gap-3 pt-1 text-xs">
            <MapPin className="w-4 h-4 text-stone-600 shrink-0" />
            <input
              id="input-event-location"
              type="text"
              placeholder="Dodaj lokalizację (np. Gabinet, Park, ul. Złota 5)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-800 placeholder:text-stone-600 focus:border-blue-500 outline-hidden text-xs"
            />
          </div>

          {/* Description Input */}
          <div className="flex items-start gap-3 pt-1 text-xs">
            <AlignLeft className="w-4 h-4 text-stone-600 shrink-0 mt-2" />
            <textarea
              id="input-event-description"
              rows={3}
              placeholder="Dodaj opis lub notatki..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-800 placeholder:text-stone-600 focus:border-blue-500 outline-hidden text-xs resize-none"
            />
          </div>

          {/* Actions Bottom Bar */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              id="btn-cancel-event-form"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              id="btn-save-event-form"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
            >
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
