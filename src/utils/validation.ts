import { RRule } from './ruleEngine';
import type { CalendarEvent } from '../types';
import { GOOGLE_CALENDAR_COLORS } from './constants';
import { isValidDate, isValidTime } from './dates';

export const MAX_EVENTS = 50_000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export function validateEvent(value: unknown): CalendarEvent {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid event / Nieprawidłowe wydarzenie');
  const e = value as CalendarEvent;
  if (
    typeof e.id !== 'string' ||
    !e.id ||
    e.id.length > 1024 ||
    typeof e.title !== 'string' ||
    !e.title.trim() ||
    e.title.length > 2000 ||
    !isValidDate(e.startDate) ||
    !isValidDate(e.endDate) ||
    e.endDate < e.startDate ||
    typeof e.allDay !== 'boolean'
  )
    throw new Error(
      'Invalid event dates or title / Nieprawidłowa data lub tytuł',
    );
  if (
    !e.allDay &&
    (!isValidTime(e.startTime) ||
      !isValidTime(e.endTime) ||
      (e.endDate === e.startDate && e.endTime <= e.startTime))
  )
    throw new Error(
      'End must follow start / Koniec musi następować po początku',
    );
  if (
    !Object.hasOwn(GOOGLE_CALENDAR_COLORS, e.color) ||
    !['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].includes(
      e.recurrence,
    )
  )
    throw new Error('Invalid event options / Nieprawidłowe opcje');
  if (
    !Array.isArray(e.reminders) ||
    e.reminders.length > 20 ||
    e.reminders.some((n) => !Number.isInteger(n) || n < 0 || n > 525600)
  )
    throw new Error('Invalid reminders / Nieprawidłowe przypomnienia');
  for (const text of [e.description, e.location])
    if (
      text !== undefined &&
      (typeof text !== 'string' || text.length > 100_000)
    )
      throw new Error('Text too large / Zbyt długi tekst');
  if (
    ![e.createdAt, e.updatedAt].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= Date.now() + 86400000,
    )
  )
    throw new Error('Invalid timestamp / Nieprawidłowy znacznik czasu');
  if (e.recurrence === 'CUSTOM') {
    const r = e.customRecurrence;
    if (
      !r ||
      !Number.isInteger(r.interval) ||
      r.interval < 1 ||
      r.interval > 999 ||
      !['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(r.unit) ||
      !['NEVER', 'COUNT', 'UNTIL_DATE'].includes(r.endType) ||
      (r.endType === 'COUNT' &&
        (!Number.isInteger(r.count) || r.count! < 1 || r.count! > 100000)) ||
      (r.endType === 'UNTIL_DATE' &&
        (!isValidDate(r.untilDate) || r.untilDate < e.startDate)) ||
      (r.daysOfWeek &&
        (!Array.isArray(r.daysOfWeek) ||
          r.daysOfWeek.some((n) => !Number.isInteger(n) || n < 0 || n > 6)))
    )
      throw new Error('Invalid recurrence / Nieprawidłowe powtarzanie');
  }
  if (
    e.rrule !== undefined &&
    (typeof e.rrule !== 'string' ||
      e.rrule.length > 2000 ||
      !/^FREQ=/.test(e.rrule) ||
      /[\r\n]/.test(e.rrule))
  )
    throw new Error('Invalid RRULE');
  if (e.rrule) {
    const options = RRule.parseString(e.rrule);
    if (
      options.freq === undefined ||
      options.freq > RRule.DAILY ||
      (options.interval !== undefined &&
        (!Number.isInteger(options.interval) ||
          options.interval < 1 ||
          options.interval > 999)) ||
      (options.count != null &&
        (!Number.isInteger(options.count) ||
          options.count < 1 ||
          options.count > 100000)) ||
      options.byhour ||
      options.byminute ||
      options.bysecond
    )
      throw new Error('Unsupported RRULE frequency / Nieobsługiwana reguła');
    new RRule({ ...options, dtstart: new Date(`${e.startDate}T00:00:00Z`) });
  }
  if (e.timeZone !== undefined) {
    if (typeof e.timeZone !== 'string') throw new Error('Invalid time zone');
    new Intl.DateTimeFormat('en', { timeZone: e.timeZone }).format();
  }
  if (
    e.exdates &&
    (!Array.isArray(e.exdates) ||
      e.exdates.length > 10000 ||
      e.exdates.some((d) => !isValidDate(d)))
  )
    throw new Error('Invalid exceptions');
  return e;
}
export function validateEvents(values: unknown): CalendarEvent[] {
  if (!Array.isArray(values) || values.length > MAX_EVENTS)
    throw new Error('Too many events / Zbyt wiele wydarzeń');
  const events = values.map(validateEvent);
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new Error('Duplicate event IDs / Powtórzone identyfikatory');
  return events;
}
