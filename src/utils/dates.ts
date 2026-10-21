const DAY = 86_400_000;
export const pad2 = (n: number) => String(n).padStart(2, '0');
/** Calendar dates are floating dates; only use UTC for date arithmetic. */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const utcDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, days: number) =>
  utcDate(new Date(parseDate(date).getTime() + days * DAY));
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY);
export const isValidDate = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(parseDate(s).getTime()) &&
  utcDate(parseDate(s)) === s;
export const isValidTime = (s: unknown): s is string =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const minutes = (time = '00:00') =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeString = (value: number) =>
  `${pad2(Math.floor(value / 60) % 24)}:${pad2(value % 60)}`;
export function shiftMonth(date: Date, delta: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + delta);
  result.setDate(
    Math.min(
      day,
      new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate(),
    ),
  );
  return result;
}
export const locale = (language = 'en') =>
  language === 'de' ? 'de-DE' : language === 'ru' ? 'ru-RU' : language === 'pl' ? 'pl-PL' : 'en-GB';
