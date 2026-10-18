import ICAL from 'ical.js';
import type { CalendarEvent } from '../types';
import { zonedDateTime, wallDateTime } from './timezone';
import { addDays, localDate, pad2 } from './dates';
import { getRRule, eventRule } from './recurrence';
import { validateEvent, validateEvents, MAX_IMPORT_BYTES } from './validation';

export function serializeICS(events: CalendarEvent[]): string {
  validateEvents(events);
  const calendar = new ICAL.Component('vcalendar');
  calendar.addPropertyWithValue('version', '2.0');
  calendar.addPropertyWithValue('prodid', '-//Kalendarz Offline//PL');
  for (const event of events) {
    const component = new ICAL.Component('vevent');
    component.addPropertyWithValue(
      'uid',
      event.id.endsWith('@kalendarz.offline')
        ? event.id
        : `${event.id}@kalendarz.offline`,
    );
    component.addPropertyWithValue(
      'dtstamp',
      ICAL.Time.fromJSDate(new Date(event.updatedAt), true),
    );
    component.addPropertyWithValue(
      'created',
      ICAL.Time.fromJSDate(new Date(event.createdAt), true),
    );
    component.addPropertyWithValue(
      'last-modified',
      ICAL.Time.fromJSDate(new Date(event.updatedAt), true),
    );
    component.addPropertyWithValue('summary', event.title);
    component.addPropertyWithValue('description', event.description || '');
    component.addPropertyWithValue('location', event.location || '');
    component.addPropertyWithValue('x-kalendarz-color', event.color);
    const addTime = (key: string, date: string, time?: string) => {
      const property = new ICAL.Property(key);
      property.setValue(
        ICAL.Time.fromString(
          event.allDay
            ? date
            : `${date}T${time}:00${event.timeZone === 'UTC' ? 'Z' : ''}`,
          property,
        ),
      );
      if (!event.allDay && event.timeZone && event.timeZone !== 'UTC')
        property.setParameter('tzid', event.timeZone);
      component.addProperty(property);
    };
    addTime('dtstart', event.startDate, event.startTime);
    addTime(
      'dtend',
      event.allDay ? addDays(event.endDate, 1) : event.endDate,
      event.endTime,
    );
    const rule = getRRule(event);
    if (rule)
      component.addPropertyWithValue('rrule', ICAL.Recur.fromString(rule));
    for (const date of event.exdates || [])
      addTime('exdate', date, event.startTime);
    for (const minutes of event.reminders) {
      const alarm = new ICAL.Component('valarm');
      alarm.addPropertyWithValue('action', 'DISPLAY');
      alarm.addPropertyWithValue('description', event.title);
      alarm.addPropertyWithValue(
        'trigger',
        ICAL.Duration.fromSeconds(-minutes * 60),
      );
      component.addSubcomponent(alarm);
    }
    calendar.addSubcomponent(component);
  }
  return calendar.toString();
}
export const exportEventsToICS = (events: CalendarEvent[]) =>
  downloadFile(
    serializeICS(events),
    `kalendarz_${localDate()}.ics`,
    'text/calendar;charset=utf-8',
  );
export function downloadFile(
  text: string,
  name: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseICSToEvents(text: string): CalendarEvent[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error('File too large / Plik jest zbyt duży');
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== 'vcalendar') throw new Error('Invalid calendar');
  const components = root.getAllSubcomponents('vevent');
  const result: CalendarEvent[] = [];
  for (const component of components) {
    // Avoid silently importing unsupported constructs as different appointments.
    if (
      component.hasProperty('rdate') ||
      component.getFirstProperty('recurrence-id')?.getParameter('range')
    )
      throw new Error(
        'RDATE / THISANDFUTURE: unsupported recurrence; no data was imported',
      );
    const start = component.getFirstPropertyValue('dtstart') as ICAL.Time;
    if (!start) throw new Error('Missing DTSTART');
    const wrapped = new ICAL.Event(component);
    const end = wrapped.endDate;
    const formatDate = (t: ICAL.Time) =>
      `${t.year}-${pad2(t.month)}-${pad2(t.day)}`;
    const formatTime = (t: ICAL.Time) => `${pad2(t.hour)}:${pad2(t.minute)}`;
    const uid = String(component.getFirstPropertyValue('uid') || '').replace(
      /@kalendarz\.offline$/,
      '',
    );
    if (!uid) throw new Error('Missing UID');
    const recurrenceId = component.getFirstPropertyValue(
      'recurrence-id',
    ) as ICAL.Time | null;
    const zone =
      start.zone.tzid === 'UTC'
        ? 'UTC'
        : component.getFirstProperty('dtstart')?.getParameter('tzid');
    if (zone)
      new Intl.DateTimeFormat('en', { timeZone: String(zone) }).format();
    let endingDate = formatDate(end),
      endingTime = formatTime(end);
    if (!start.isDate && component.getFirstProperty('dtend')) {
      const endZone =
        end.zone.tzid === 'UTC'
          ? 'UTC'
          : component.getFirstProperty('dtend')?.getParameter('tzid');
      if (String(endZone || '') !== String(zone || '')) {
        const converted = wallDateTime(
          zonedDateTime(
            endingDate,
            endingTime,
            endZone ? String(endZone) : undefined,
          ),
          zone ? String(zone) : undefined,
        );
        endingDate = converted.date;
        endingTime = converted.time;
      }
    }
    const stamp = (key: string, fallback: number) => {
      const time = component.getFirstPropertyValue(key) as ICAL.Time | null;
      return time ? Math.min(time.toJSDate().getTime(), Date.now()) : fallback;
    };
    const alarms = component.getAllSubcomponents('valarm').map((alarm) => {
      const trigger = alarm.getFirstProperty('trigger');
      const duration = trigger?.getFirstValue();
      if (
        !(duration instanceof ICAL.Duration) ||
        trigger?.getParameter('related') === 'END' ||
        duration.toSeconds() > 0 ||
        duration.toSeconds() % 60 !== 0
      )
        throw new Error(
          'Unsupported alarm: only whole minutes before start are supported',
        );
      return -duration.toSeconds() / 60;
    });
    const rule = component.getFirstPropertyValue('rrule') as ICAL.Recur | null;
    const event = validateEvent({
      id: recurrenceId ? `${uid}#${formatDate(recurrenceId)}` : uid,
      title: String(
        component.getFirstPropertyValue('summary') || 'Wydarzenie / Event',
      ),
      description: String(component.getFirstPropertyValue('description') || ''),
      location: String(component.getFirstPropertyValue('location') || ''),
      startDate: formatDate(start),
      endDate: start.isDate ? addDays(endingDate, -1) : endingDate,
      startTime: start.isDate ? undefined : formatTime(start),
      endTime: start.isDate ? undefined : endingTime,
      allDay: start.isDate,
      color: component.getFirstPropertyValue('x-kalendarz-color') || 'peacock',
      recurrence: 'NONE',
      rrule: rule?.toString(),
      exdates: component
        .getAllProperties('exdate')
        .flatMap((p) => p.getValues().map((t) => formatDate(t as ICAL.Time))),
      reminders: [...new Set(alarms)],
      createdAt: stamp('created', Date.now()),
      updatedAt: stamp('last-modified', stamp('dtstamp', Date.now())),
      timeZone: zone ? String(zone) : undefined,
    });
    eventRule(event); // Validate RRULE before committing any records.
    result.push(event);
  }
  // Detached instances replace the master occurrence while preserving its series.
  for (const component of components) {
    const recurrenceId = component.getFirstPropertyValue(
      'recurrence-id',
    ) as ICAL.Time | null;
    if (!recurrenceId) continue;
    const uid = String(component.getFirstPropertyValue('uid')).replace(
      /@kalendarz\.offline$/,
      '',
    );
    const master = result.find((e) => e.id === uid);
    if (master)
      master.exdates = [
        ...new Set([
          ...(master.exdates || []),
          `${recurrenceId.year}-${pad2(recurrenceId.month)}-${pad2(recurrenceId.day)}`,
        ]),
      ];
  }
  return validateEvents(result);
}
