import { tr } from '../utils/i18n';
import { reminderLabel, colorLabel } from '../utils/i18n';
import { Dialog } from './Dialog';
import { localDate, addDays, minutes } from '../utils/dates';
import { validateEvent } from '../utils/validation';
import { getTranslation, type AppLanguage } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import {
  CalendarEvent,
  GoogleCalendarColor,
  RecurrenceFreq,
  CustomRecurrenceRule,
} from '../types';
import {
  GOOGLE_CALENDAR_COLORS,
  STANDARD_REMINDER_OPTIONS,
} from '../utils/constants';
import {
  X,
  Clock,
  MapPin,
  AlignLeft,
  Bell,
  Repeat,
  Trash2,
  Palette,
  Plus,
} from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  language?: AppLanguage;
  eventToEdit?: CalendarEvent | null;
  initialDate?: string;
  initialTime?: string;
  defaultColor?: GoogleCalendarColor;
  defaultReminder?: number;
  defaultDuration?: number;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void | Promise<void>;
  onDelete?: (eventId: string) => void | Promise<void>;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  language = 'pl',
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
  const t = getTranslation(language);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preserveRule, setPreserveRule] = useState(true);
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
  const [customRecurrence, setCustomRecurrence] =
    useState<CustomRecurrenceRule>({
      interval: 1,
      unit: 'WEEK',
      daysOfWeek: [1],
      endType: 'NEVER',
    });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reminders, setReminders] = useState<number[]>([defaultReminder]);
  const [customReminderVal, setCustomReminderVal] = useState<string>('');
  const [showCustomReminderInput, setShowCustomReminderInput] = useState(false);

  useEffect(() => {
    setShowDeleteConfirm(false);
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
      if (eventToEdit.customRecurrence) {
        setCustomRecurrence(eventToEdit.customRecurrence);
      } else {
        const d = new Date(`${eventToEdit.startDate}T12:00:00`);
        setCustomRecurrence({
          interval: 1,
          unit: 'WEEK',
          daysOfWeek: [d.getDay()],
          endType: 'NEVER',
        });
      }
      setReminders(eventToEdit.reminders || [defaultReminder]);
    } else {
      const todayStr = initialDate || localDate();
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
      setEndDate(addDays(todayStr, Math.floor(totalMinutes / 1440)));
      setEndTime(endT);
      setAllDay(false);
      setLocation('');
      setDescription('');
      setColor(defaultColor);
      setRecurrence('NONE');
      const d = new Date(`${todayStr}T12:00:00`);
      setCustomRecurrence({
        interval: 1,
        unit: 'WEEK',
        daysOfWeek: [d.getDay()],
        endType: 'NEVER',
      });
      setReminders(defaultReminder >= 0 ? [defaultReminder] : []);
    }
    setShowCustomReminderInput(false);
  }, [
    isOpen,
    eventToEdit,
    initialDate,
    initialTime,
    defaultColor,
    defaultReminder,
    defaultDuration,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    if (saving) return;
    setFormError('');
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    const eventPayload: CalendarEvent = {
      id: eventToEdit
        ? eventToEdit.id
        : `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      customRecurrence: recurrence === 'CUSTOM' ? customRecurrence : undefined,
      createdAt: eventToEdit ? eventToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
      rrule: preserveRule ? eventToEdit?.rrule : undefined,
      exdates: eventToEdit?.exdates,
      timeZone: eventToEdit?.timeZone,
    };

    try {
      validateEvent(eventPayload);
      setSaving(true);
      await onSave(eventPayload);
      onClose();
    } catch (error) {
      setFormError(String(error));
    } finally {
      setSaving(false);
    }
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
    <Dialog
      onClose={onClose}
      label={eventToEdit ? t.editEvent : t.newEvent}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="modal-event-form"
        className="relative theme-surface theme-text rounded-3xl max-w-lg w-full shadow-2xl theme-border border overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Custom In-App Delete Confirmation Modal (Replaces native browser popup) */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="theme-surface theme-text rounded-2xl max-w-sm w-full p-5 shadow-2xl theme-border border text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold theme-text">
                  {tr(language, 'Usuń wydarzenie', 'Delete event')}
                </h4>
                <p className="text-xs theme-muted mt-1 leading-relaxed">
                  {tr(language, 'Czy na pewno chcesz usunąć to wydarzenie z kalendarza?', 'Are you sure you want to delete this event?')}
                </p>
                {eventToEdit && (
                  <p className="text-xs font-semibold theme-text mt-2 px-3 py-1.5 rounded-lg theme-subtle truncate">
                    „{eventToEdit.title}”
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {/* Przycisk NIE na czerwono jak prosił użytkownik */}
                <button
                  type="button"
                  id="btn-confirm-delete-no"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {tr(language, 'Nie', 'No')}
                </button>
                {/* Przycisk TAK */}
                <button
                  type="button"
                  id="btn-confirm-delete-yes"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      if (eventToEdit && onDelete)
                        await onDelete(eventToEdit.id);
                      onClose();
                    } catch (error) {
                      setShowDeleteConfirm(false);
                      setFormError(String(error));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl theme-subtle theme-hover theme-border border theme-text text-xs font-bold transition-colors"
                >
                  {tr(language, 'Tak, usuń', 'Yes, delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 theme-border border-b theme-subtle">
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full ring-2 ring-black/20"
              style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[color].dot }}
            />
            <h3 className="text-sm font-bold theme-text">
              {eventToEdit ? t.editEvent : t.newEvent}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {eventToEdit && onDelete && (
              <button
                type="button"
                id="btn-delete-event"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                title={t.deleteEvent}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-close-event-modal"
              aria-label={t.close}
              onClick={onClose}
              className="p-1.5 rounded-xl theme-muted hover:theme-text theme-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto max-h-[80vh]"
        >
          {formError && (
            <p role="alert" className="text-red-500 text-sm">
              {formError}
            </p>
          )}
          {eventToEdit?.rrule && (
            <label className="block text-xs">
              <input
                type="checkbox"
                checked={preserveRule}
                onChange={(e) => setPreserveRule(e.target.checked)}
              />{' '}
              {tr(language, 'Zachowaj regułę powtarzania z ICS', 'Keep imported ICS recurrence')}
              : {eventToEdit.rrule}
            </label>
          )}
          {/* Title input */}
          <div>
            <input
              id="input-event-title"
              type="text"
              required
              placeholder={t.titlePlaceholder}
              aria-label={t.titlePlaceholder}
              maxLength={2000}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base sm:text-lg font-bold border-b-2 theme-border focus:border-blue-500 outline-hidden pb-1.5 bg-transparent theme-text placeholder:theme-muted"
              data-autofocus="true"
            />
          </div>

          {/* Date & Time Row */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold theme-text">
                <Clock className="w-4 h-4 theme-muted" />
                <span>
                  {tr(language, 'Termin i czas trwania', 'Date and duration')}
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer theme-muted select-none">
                <input
                  id="checkbox-all-day"
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded-sm accent-blue-600 focus:ring-blue-500"
                />
                <span>{tr(language, 'Cały dzień', 'All day')}</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] theme-muted">
                  {tr(language, 'Początek', 'Start')}
                </label>
                <input
                  id="input-start-date"
                  aria-label="Start date"
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
                    aria-label="Start time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] theme-muted">
                  {tr(language, 'Koniec', 'End')}
                </label>
                <input
                  id="input-end-date"
                  aria-label="End date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl theme-input focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {!allDay && (
                  <input
                    id="input-end-time"
                    aria-label="End time"
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
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-center gap-3">
              <Repeat className="w-4 h-4 theme-muted shrink-0" />
              <div className="flex-1">
                <select
                  id="select-recurrence"
                  aria-label="Recurrence"
                  value={recurrence}
                  onChange={(e) => {
                    setPreserveRule(false);
                    setRecurrence(e.target.value as RecurrenceFreq);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl theme-input text-xs focus:outline-none"
                >
                  <option value="NONE">
                    {tr(language, 'Nie powtarza się', 'Does not repeat')}
                  </option>
                  <option value="DAILY">
                    {tr(language, 'Codziennie', 'Daily')}
                  </option>
                  <option value="WEEKLY">
                    {tr(language, 'Co tydzień', 'Weekly')}
                  </option>
                  <option value="MONTHLY">
                    {tr(language, 'Co miesiąc', 'Monthly')}
                  </option>
                  <option value="YEARLY">
                    {tr(language, 'Co rok', 'Yearly')}
                  </option>
                  <option value="CUSTOM">
                    {tr(language, 'Niestandardowe...', 'Custom...')}
                  </option>
                </select>
              </div>
            </div>

            {/* Custom Recurrence Editor */}
            {recurrence === 'CUSTOM' && (
              <div className="ml-7 p-3 rounded-2xl theme-subtle theme-border border space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="theme-muted text-xs">
                    {tr(language, 'Powtarzaj co:', 'Repeat every:')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    aria-label={
                      tr(language, 'Co ile okresów', 'Repeat interval')
                    }
                    value={customRecurrence.interval}
                    onChange={(e) =>
                      setCustomRecurrence({
                        ...customRecurrence,
                        interval: Math.max(
                          1,
                          parseInt(e.target.value, 10) || 1,
                        ),
                      })
                    }
                    className="w-14 px-2 py-1 rounded-lg theme-input text-center font-bold"
                  />
                  <select
                    aria-label={
                      tr(language, 'Jednostka powtarzania', 'Repeat unit')
                    }
                    value={customRecurrence.unit}
                    onChange={(e) =>
                      setCustomRecurrence({
                        ...customRecurrence,
                        unit: e.target.value as
                          | 'DAY'
                          | 'WEEK'
                          | 'MONTH'
                          | 'YEAR',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg theme-input font-medium"
                  >
                    <option value="DAY">
                      {tr(language, 'Dni', 'Days')}
                    </option>
                    <option value="WEEK">
                      {tr(language, 'Tygodnie', 'Weeks')}
                    </option>
                    <option value="MONTH">
                      {tr(language, 'Miesiące', 'Months')}
                    </option>
                    <option value="YEAR">
                      {tr(language, 'Lata', 'Years')}
                    </option>
                  </select>
                </div>

                {/* Days of week selector if unit is WEEK */}
                {customRecurrence.unit === 'WEEK' && (
                  <div className="space-y-1.5">
                    <span className="theme-muted text-[11px] block font-semibold">
                      {tr(language, 'W dniach:', 'On days:')}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { dow: 1, label: tr(language, 'Pn', 'Mon') },
                        { dow: 2, label: tr(language, 'Wt', 'Tue') },
                        { dow: 3, label: tr(language, 'Śr', 'Wed') },
                        { dow: 4, label: tr(language, 'Cz', 'Thu') },
                        { dow: 5, label: tr(language, 'Pt', 'Fri') },
                        { dow: 6, label: tr(language, 'So', 'Sat') },
                        { dow: 0, label: tr(language, 'Nd', 'Sun') },
                      ].map(({ dow, label }) => {
                        const isSelected = (
                          customRecurrence.daysOfWeek || []
                        ).includes(dow);
                        return (
                          <button
                            key={dow}
                            type="button"
                            onClick={() => {
                              const current = customRecurrence.daysOfWeek || [];
                              const next = isSelected
                                ? current.filter((d) => d !== dow)
                                : [...current, dow];
                              setCustomRecurrence({
                                ...customRecurrence,
                                daysOfWeek: next.length > 0 ? next : [dow],
                              });
                            }}
                            className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'theme-surface theme-text theme-border border hover:opacity-80'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* End type */}
                <div className="space-y-2 pt-2 border-t theme-border">
                  <span className="theme-muted text-[11px] block font-semibold">
                    {tr(language, 'Koniec powtarzania:', 'Repeat until:')}
                  </span>

                  {/* Radio 1: Nigdy */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recurrence-end"
                      checked={customRecurrence.endType === 'NEVER'}
                      onChange={() =>
                        setCustomRecurrence({
                          ...customRecurrence,
                          endType: 'NEVER',
                        })
                      }
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs theme-text">
                      {tr(language, 'Nigdy', 'Never')}
                    </span>
                  </label>

                  {/* Radio 2: W dniu */}
                  <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                    <input
                      type="radio"
                      name="recurrence-end"
                      checked={customRecurrence.endType === 'UNTIL_DATE'}
                      onChange={() =>
                        setCustomRecurrence({
                          ...customRecurrence,
                          endType: 'UNTIL_DATE',
                          untilDate: customRecurrence.untilDate || startDate,
                        })
                      }
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs theme-text">
                      {tr(language, 'W dniu:', 'On date:')}
                    </span>
                    {customRecurrence.endType === 'UNTIL_DATE' && (
                      <input
                        type="date"
                        aria-label={
                          tr(language, 'Powtarzaj do', 'Repeat until')
                        }
                        value={customRecurrence.untilDate || startDate}
                        min={startDate}
                        onChange={(e) =>
                          setCustomRecurrence({
                            ...customRecurrence,
                            untilDate: e.target.value,
                          })
                        }
                        className="px-2 py-0.5 rounded-lg theme-input text-xs"
                      />
                    )}
                  </label>

                  {/* Radio 3: Po X powtórzeniach */}
                  <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                    <input
                      type="radio"
                      name="recurrence-end"
                      checked={customRecurrence.endType === 'COUNT'}
                      onChange={() =>
                        setCustomRecurrence({
                          ...customRecurrence,
                          endType: 'COUNT',
                          count: customRecurrence.count || 10,
                        })
                      }
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs theme-text">
                      {tr(language, 'Po:', 'After:')}
                    </span>
                    {customRecurrence.endType === 'COUNT' && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={customRecurrence.count || 10}
                          onChange={(e) =>
                            setCustomRecurrence({
                              ...customRecurrence,
                              count: Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1,
                              ),
                            })
                          }
                          className="w-14 px-1.5 py-0.5 rounded-lg theme-input text-xs text-center font-bold"
                        />
                        <span className="text-xs theme-muted">
                          {tr(language, 'wystąpieniach', 'occurrences')}
                        </span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Color Palette (11 Google Calendar Colors) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold theme-text">
              <Palette className="w-4 h-4 theme-muted" />
              <span>{tr(language, 'Kolor:', 'Color:')} </span>
              <span className="font-bold">
                {colorLabel(
                  color,
                  language,
                  GOOGLE_CALENDAR_COLORS[color].name,
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.values(GOOGLE_CALENDAR_COLORS).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  id={`color-choice-${c.id}`}
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                    color === c.id
                      ? 'ring-2 ring-white scale-115 shadow-xs'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.dot }}
                  title={colorLabel(c.id, language, c.name)}
                >
                  {color === c.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reminders / Push Notifications */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold theme-text">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 theme-muted" />
                <span>{tr(language, 'Powiadomienia', 'Reminders')}</span>
              </div>
              <button
                type="button"
                id="btn-add-reminder"
                onClick={() => setShowCustomReminderInput(true)}
                className="text-blue-500 hover:text-blue-400 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr(language, 'Dodaj alert', 'Add reminder')}
              </button>
            </div>

            {/* Existing reminders tags */}
            <div className="flex flex-wrap gap-1.5">
              {reminders.map((min) => {
                const label = reminderLabel(min, language);

                return (
                  <span
                    key={min}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl theme-subtle theme-border border theme-text text-xs"
                  >
                    <span>{label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(min)}
                      aria-label={`${tr(language, 'Usuń przypomnienie', 'Remove reminder')}: ${label}`}
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
                  aria-label="Reminder"
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
                  <option value="" disabled>
                    {tr(language, 'Wybierz typowy czas...', 'Choose a reminder...')}
                  </option>
                  {STANDARD_REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {reminderLabel(o.value, language)}
                    </option>
                  ))}
                </select>

                <span className="text-xs theme-muted">
                  {tr(language, 'lub', 'or')}
                </span>

                <div className="flex items-center gap-1">
                  <input
                    id="input-custom-minutes"
                    aria-label="Minutes"
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
              aria-label="Location"
              type="text"
              placeholder={t.locationPlaceholder}
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
              aria-label="Description"
              rows={3}
              placeholder={t.descPlaceholder}
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
              {tr(language, 'Anuluj', 'Cancel')}
            </button>
            <button
              type="submit"
              id="btn-save-event-form"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors"
            >
              {tr(language, 'Zapisz', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
