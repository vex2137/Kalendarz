import type { CalendarEvent } from '../src/types';
export const event = (
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id: 'event',
  title: 'Meeting',
  startDate: '2026-10-19',
  endDate: '2026-10-19',
  startTime: '09:00',
  endTime: '10:00',
  allDay: false,
  color: 'peacock',
  recurrence: 'NONE',
  reminders: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});
export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}
