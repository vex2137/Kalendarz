import type { CalendarEvent } from '../types';
import { RRule } from './ruleEngine';
import {
  addDays,
  daysBetween,
  parseDate,
  utcDate,
  localDate,
  minutes,
} from './dates';
import { zonedDateTime, wallDateTime } from './timezone';
export const parseISODate = parseDate;
export const formatISODate = localDate;
// Maps 0=Nd, 1=Pn, 2=Wt, 3=Śr, 4=Cz, 5=Pt, 6=So
const DOW_LABELS_PL: Record<number, string> = {
  1: 'Pn',
  2: 'Wt',
  3: 'Śr',
  4: 'Cz',
  5: 'Pt',
  6: 'So',
  0: 'Nd',
};

/**
 * Returns a human-friendly Polish description of the event recurrence
 */
export function getRecurrenceLabel(
  event: CalendarEvent,
  language = 'pl',
): string {
  if (event.rrule) return event.rrule;
  if (language === 'ru') {
    if (event.recurrence === 'CUSTOM' && event.customRecurrence) {
      const r = event.customRecurrence;
      const unit = { DAY: 'дн.', WEEK: 'нед.', MONTH: 'мес.', YEAR: 'г.' }[r.unit];
      return `Каждые ${r.interval} ${unit}${r.endType === 'COUNT' ? ` (${r.count} повт.)` : r.endType === 'UNTIL_DATE' ? ` (до ${r.untilDate})` : ''}`;
    }
    return ({ NONE: 'Не повторяется', DAILY: 'Ежедневно', WEEKLY: 'Еженедельно', MONTHLY: 'Ежемесячно', YEARLY: 'Ежегодно' } as Record<string, string>)[event.recurrence] || 'Повторяется';
  }
  if (language === 'en') {
    if (event.rrule) return event.rrule;
    if (event.recurrence === 'CUSTOM' && event.customRecurrence) {
      const r = event.customRecurrence;
      return `Every ${r.interval} ${r.unit.toLowerCase()}${r.interval > 1 ? 's' : ''}${r.endType === 'COUNT' ? ` (${r.count} times)` : r.endType === 'UNTIL_DATE' ? ` (until ${r.untilDate})` : ''}`;
    }
    return (
      (
        {
          NONE: 'Does not repeat',
          DAILY: 'Daily',
          WEEKLY: 'Weekly',
          MONTHLY: 'Monthly',
          YEARLY: 'Yearly',
        } as Record<string, string>
      )[event.recurrence] || 'Repeating'
    );
  }
  if (!event.recurrence || event.recurrence === 'NONE') {
    return 'Nie powtarza się';
  }

  if (event.recurrence === 'DAILY') {
    return 'Codziennie';
  }
  if (event.recurrence === 'WEEKLY') {
    return 'Co tydzień';
  }
  if (event.recurrence === 'MONTHLY') {
    return 'Co miesiąc';
  }
  if (event.recurrence === 'YEARLY') {
    return 'Co rok';
  }

  if (event.recurrence === 'CUSTOM' && event.customRecurrence) {
    const { interval, unit, daysOfWeek, endType, untilDate, count } =
      event.customRecurrence;
    const intervalStr = interval > 1 ? `co ${interval} ` : 'co ';

    let unitStr = '';
    if (unit === 'DAY') {
      unitStr = interval === 1 ? 'dzień' : 'dni';
    } else if (unit === 'WEEK') {
      unitStr = interval === 1 ? 'tydzień' : 'tygodnie';
    } else if (unit === 'MONTH') {
      unitStr = interval === 1 ? 'miesiąc' : 'miesięcy';
    } else if (unit === 'YEAR') {
      unitStr = interval === 1 ? 'rok' : 'lat';
    }

    let daysStr = '';
    if (unit === 'WEEK' && daysOfWeek && daysOfWeek.length > 0) {
      daysStr = ` w: ${daysOfWeek.map((d) => DOW_LABELS_PL[d] || String(d)).join(', ')}`;
    }

    let endStr = '';
    if (endType === 'UNTIL_DATE' && untilDate) {
      endStr = ` (do ${untilDate})`;
    } else if (endType === 'COUNT' && count) {
      endStr = ` (${count} razy)`;
    }

    return `Powtarzaj ${intervalStr}${unitStr}${daysStr}${endStr}`;
  }

  return 'Powtarza się';
}

const rules = new WeakMap<CalendarEvent, InstanceType<typeof RRule>>();
export function eventRule(
  event: CalendarEvent,
): InstanceType<typeof RRule> | null {
  if (event.recurrence === 'NONE' && !event.rrule) return null;
  const cached = rules.get(event);
  if (cached) return cached;
  const r = event.customRecurrence;
  const frequencies: Record<string, number> = {
    DAY: RRule.DAILY,
    WEEK: RRule.WEEKLY,
    MONTH: RRule.MONTHLY,
    YEAR: RRule.YEARLY,
    DAILY: RRule.DAILY,
    WEEKLY: RRule.WEEKLY,
    MONTHLY: RRule.MONTHLY,
    YEARLY: RRule.YEARLY,
  };
  const options: Partial<import('rrule').Options> = event.rrule
    ? RRule.parseString(event.rrule)
    : {
        freq: frequencies[
          event.recurrence === 'CUSTOM' ? r!.unit : event.recurrence
        ],
        interval: event.recurrence === 'CUSTOM' ? r!.interval : 1,
        ...(event.recurrence === 'CUSTOM' &&
        r?.unit === 'WEEK' &&
        r.daysOfWeek?.length
          ? {
              byweekday: [...new Set(r.daysOfWeek)].map(
                (d) =>
                  [
                    RRule.SU,
                    RRule.MO,
                    RRule.TU,
                    RRule.WE,
                    RRule.TH,
                    RRule.FR,
                    RRule.SA,
                  ][d],
              ),
            }
          : {}),
        ...(r?.endType === 'COUNT' ? { count: r.count } : {}),
        ...(r?.endType === 'UNTIL_DATE'
          ? { until: parseDate(r.untilDate!) }
          : {}),
      };
  if (event.rrule && options.until && !event.allDay) {
    const encoded = /(?:^|;)UNTIL=(\d{8})(?:T(\d{6})(Z)?)?/.exec(event.rrule);
    if (encoded?.[2]) {
      const source = encoded[3]
        ? wallDateTime(options.until, event.timeZone)
        : {
            date: utcDate(options.until),
            time: options.until.toISOString().slice(11, 16),
          };
      options.until = parseDate(
        source.time < event.startTime! ? addDays(source.date, -1) : source.date,
      );
    }
  }
  const rule = new RRule({
    ...options,
    dtstart: parseDate(event.startDate),
    wkst: options.wkst ?? RRule.MO,
  });
  rules.set(event, rule);
  return rule;
}
export function getRRule(event: CalendarEvent) {
  if (event.rrule) return event.rrule;
  let rule = eventRule(event)?.toString().split('RRULE:')[1] || '';
  if (event.customRecurrence?.endType === 'UNTIL_DATE') {
    const date = event.customRecurrence.untilDate!;
    let until = date.replaceAll('-', '');
    if (!event.allDay)
      until = event.timeZone
        ? new Date(
            zonedDateTime(date, '23:59', event.timeZone).getTime() + 59000,
          )
            .toISOString()
            .replace(/[-:]/g, '')
            .replace('.000', '')
        : `${until}T235959`;
    rule = rule.replace(/UNTIL=[^;]+/, `UNTIL=${until}`);
  }
  return rule;
}

export interface CalendarOccurrence {
  event: CalendarEvent;
  date: string;
  occurrenceDate: string;
  startMinutes: number;
  endMinutes: number;
  /** Derived display instants for zoned events; never persisted in CalendarEvent. */
  startInstant?: number;
  endInstant?: number;
}
export function occurrenceDates(
  event: CalendarEvent,
  from: string,
  to: string,
): string[] {
  const rule = eventRule(event);
  const dates = rule
    ? rule.between(parseDate(from), parseDate(to), true).map(utcDate)
    : event.startDate >= from && event.startDate <= to
      ? [event.startDate]
      : [];
  return event.exdates?.length
    ? dates.filter((d) => !event.exdates!.includes(d))
    : dates;
}
/** Expand once per range, preserving original events for editing and split midnight spans. */
const indexCache = new WeakMap<
  CalendarEvent[],
  Map<string, Map<string, CalendarOccurrence[]>>
>();
export function buildEventIndex(
  events: CalendarEvent[],
  from: string,
  to: string,
): Map<string, CalendarOccurrence[]> {
  // A running app can change system zones; never reuse occurrences in the old zone.
  const key = `${from}:${to}:${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  const previous = indexCache.get(events)?.get(key);
  if (previous) return previous;
  const result = new Map<string, CalendarOccurrence[]>();
  for (const event of events) {
    const span = daysBetween(event.startDate, event.endDate);
    const first = addDays(from, -span - (event.timeZone ? 1 : 0));
    if (
      event.startDate > (event.timeZone ? addDays(to, 1) : to) ||
      (event.recurrence === 'NONE' &&
        !event.rrule &&
        event.endDate < (event.timeZone ? addDays(from, -1) : from))
    )
      continue;
    for (const occurrenceDate of occurrenceDates(
      event,
      first,
      event.timeZone ? addDays(to, 1) : to,
    )) {
      let start = occurrenceDate,
        end = addDays(start, span),
        startTime = event.startTime,
        endTime = event.endTime;
      let actualStart: number | undefined, actualEnd: number | undefined;
      if (event.timeZone && !event.allDay) {
        const startInstant = zonedDateTime(start, startTime!, event.timeZone),
          endInstant = zonedDateTime(end, endTime!, event.timeZone);
        actualStart = startInstant.getTime();
        actualEnd = endInstant.getTime();
        start = localDate(startInstant);
        end = localDate(endInstant);
        startTime = `${String(startInstant.getHours()).padStart(2, '0')}:${String(startInstant.getMinutes()).padStart(2, '0')}`;
        endTime = `${String(endInstant.getHours()).padStart(2, '0')}:${String(endInstant.getMinutes()).padStart(2, '0')}`;
      }
      for (
        let date = start < from ? from : start;
        date <= end && date <= to;
        date = addDays(date, 1)
      ) {
        const startMinutes =
          event.allDay || date !== start ? 0 : minutes(startTime);
        let endMinutes =
          event.allDay || date !== end ? 1440 : minutes(endTime);
        const instants = actualStart !== undefined && actualEnd !== undefined ? {
          startInstant: Math.max(actualStart, new Date(`${date}T00:00:00`).getTime()),
          endInstant: Math.min(actualEnd, new Date(`${addDays(date, 1)}T00:00:00`).getTime()),
        } : undefined;
        if (!event.allDay && endMinutes <= startMinutes) {
          // During the repeated hour, a later instant can have an earlier wall time.
          if (!instants || instants.endInstant <= instants.startInstant) continue;
          endMinutes = Math.min(1440, startMinutes + (instants.endInstant - instants.startInstant) / 60000);
        }
        const occurrence = {
          event,
          date,
          occurrenceDate,
          startMinutes,
          endMinutes,
          ...instants,
        };
        const bucket = result.get(date);
        if (bucket) bucket.push(occurrence);
        else result.set(date, [occurrence]);
      }
    }
  }
  for (const bucket of result.values())
    bucket.sort(
      (a, b) =>
        Number(b.event.allDay) - Number(a.event.allDay) ||
        a.startMinutes - b.startMinutes ||
        a.event.title.localeCompare(b.event.title),
    );
  const cache = indexCache.get(events) || new Map();
  if (cache.size >= 6) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  indexCache.set(events, cache);
  return result;
}
export function isEventOccurringOnDate(
  event: CalendarEvent,
  date: string,
): boolean {
  return (buildEventIndex([event], date, date).get(date)?.length || 0) > 0;
}
export function getEventsForDate(
  events: CalendarEvent[],
  date: string,
): CalendarEvent[] {
  return (buildEventIndex(events, date, date).get(date) || []).map(
    (o) => o.event,
  );
}
/** Year view needs presence, not hundreds of thousands of materialized rows. */
export function eventDatePresence(
  events: CalendarEvent[],
  from: string,
  to: string,
): Set<string> {
  const dates = new Set<string>();
  const length = daysBetween(from, to) + 1;
  for (const event of events) {
    for (const date of buildEventIndex([event], from, to).keys())
      dates.add(date);
    if (dates.size === length) break;
  }
  return dates;
}
