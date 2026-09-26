import { CalendarEvent, CustomRecurrenceRule } from '../types';
import { DAY_NAMES_SHORT_PL } from './constants';

// Helper to parse YYYY-MM-DD into Date object at midnight UTC
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Convert Date to YYYY-MM-DD
export function formatISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
export function getRecurrenceLabel(event: CalendarEvent): string {
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
    const { interval, unit, daysOfWeek, endType, untilDate, count } = event.customRecurrence;
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

/**
 * Checks whether an event occurs on a specific target date (YYYY-MM-DD)
 */
export function isEventOccurringOnDate(event: CalendarEvent, targetDateStr: string): boolean {
  if (targetDateStr < event.startDate) {
    return false;
  }

  // Exact match on start date
  if (event.startDate === targetDateStr) {
    return true;
  }

  // Non-recurring event: check multi-day range
  if (!event.recurrence || event.recurrence === 'NONE') {
    if (event.endDate && event.endDate >= targetDateStr && event.startDate <= targetDateStr) {
      return true;
    }
    return false;
  }

  // If custom recurrence has untilDate
  if (event.recurrence === 'CUSTOM' && event.customRecurrence?.endType === 'UNTIL_DATE' && event.customRecurrence.untilDate) {
    if (targetDateStr > event.customRecurrence.untilDate) {
      return false;
    }
  }

  const dStart = parseISODate(event.startDate);
  const dTarget = parseISODate(targetDateStr);

  const diffDays = Math.round((dTarget.getTime() - dStart.getTime()) / (1000 * 3600 * 24));
  if (diffDays < 0) return false;

  // DAILY recurrence
  if (event.recurrence === 'DAILY' || (event.recurrence === 'CUSTOM' && event.customRecurrence?.unit === 'DAY')) {
    const interval = event.recurrence === 'CUSTOM' && event.customRecurrence?.interval ? event.customRecurrence.interval : 1;
    if (diffDays % interval !== 0) return false;

    if (event.recurrence === 'CUSTOM' && event.customRecurrence?.endType === 'COUNT' && event.customRecurrence.count) {
      const occurrenceIndex = Math.floor(diffDays / interval);
      if (occurrenceIndex >= event.customRecurrence.count) return false;
    }
    return true;
  }

  // WEEKLY recurrence
  if (event.recurrence === 'WEEKLY' || (event.recurrence === 'CUSTOM' && event.customRecurrence?.unit === 'WEEK')) {
    const interval = event.recurrence === 'CUSTOM' && event.customRecurrence?.interval ? event.customRecurrence.interval : 1;
    const targetDow = dTarget.getUTCDay(); // 0=Sunday, 1=Monday...

    const allowedDays = (event.recurrence === 'CUSTOM' && event.customRecurrence?.daysOfWeek && event.customRecurrence.daysOfWeek.length > 0)
      ? event.customRecurrence.daysOfWeek
      : [dStart.getUTCDay()];

    if (!allowedDays.includes(targetDow)) {
      return false;
    }

    // Check week interval from start date's week
    // Find the Monday of start date's week and Monday of target date's week
    const startDow = dStart.getUTCDay();
    const startMondayOffset = startDow === 0 ? -6 : 1 - startDow;
    const startMonday = new Date(dStart.getTime() + startMondayOffset * 86400000);

    const targetMondayOffset = targetDow === 0 ? -6 : 1 - targetDow;
    const targetMonday = new Date(dTarget.getTime() + targetMondayOffset * 86400000);

    const diffWeeks = Math.round((targetMonday.getTime() - startMonday.getTime()) / (1000 * 3600 * 24 * 7));
    if (diffWeeks < 0 || diffWeeks % interval !== 0) {
      return false;
    }

    if (event.recurrence === 'CUSTOM' && event.customRecurrence?.endType === 'COUNT' && event.customRecurrence.count) {
      // Rough occurrence count approximation
      const totalOccurrencesSoFar = Math.floor(diffWeeks / interval) * allowedDays.length;
      if (totalOccurrencesSoFar >= event.customRecurrence.count) return false;
    }

    return true;
  }

  // MONTHLY recurrence
  if (event.recurrence === 'MONTHLY' || (event.recurrence === 'CUSTOM' && event.customRecurrence?.unit === 'MONTH')) {
    const interval = event.recurrence === 'CUSTOM' && event.customRecurrence?.interval ? event.customRecurrence.interval : 1;
    if (dTarget.getUTCDate() !== dStart.getUTCDate()) {
      return false;
    }

    const diffMonths = (dTarget.getUTCFullYear() - dStart.getUTCFullYear()) * 12 + (dTarget.getUTCMonth() - dStart.getUTCMonth());
    if (diffMonths < 0 || diffMonths % interval !== 0) {
      return false;
    }

    if (event.recurrence === 'CUSTOM' && event.customRecurrence?.endType === 'COUNT' && event.customRecurrence.count) {
      const occurrenceIndex = Math.floor(diffMonths / interval);
      if (occurrenceIndex >= event.customRecurrence.count) return false;
    }

    return true;
  }

  // YEARLY recurrence
  if (event.recurrence === 'YEARLY' || (event.recurrence === 'CUSTOM' && event.customRecurrence?.unit === 'YEAR')) {
    const interval = event.recurrence === 'CUSTOM' && event.customRecurrence?.interval ? event.customRecurrence.interval : 1;
    if (dTarget.getUTCMonth() !== dStart.getUTCMonth() || dTarget.getUTCDate() !== dStart.getUTCDate()) {
      return false;
    }

    const diffYears = dTarget.getUTCFullYear() - dStart.getUTCFullYear();
    if (diffYears < 0 || diffYears % interval !== 0) {
      return false;
    }

    if (event.recurrence === 'CUSTOM' && event.customRecurrence?.endType === 'COUNT' && event.customRecurrence.count) {
      const occurrenceIndex = Math.floor(diffYears / interval);
      if (occurrenceIndex >= event.customRecurrence.count) return false;
    }

    return true;
  }

  return false;
}

/**
 * Filter all events that occur on the specified date
 */
export function getEventsForDate(events: CalendarEvent[], targetDateStr: string): CalendarEvent[] {
  return events.filter((e) => isEventOccurringOnDate(e, targetDateStr));
}
