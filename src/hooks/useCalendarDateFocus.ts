import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { calendarDateTarget } from '../utils/calendarLayout';

/** One Tab stop for dates; moving focus never selects a day or opens its editor. */
export function useCalendarDateFocus(dates: string[], preferred: string, startOfWeek: number,
  onBrowseDate?: (date: string) => void) {
  const root = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(preferred);
  const pending = useRef<string | null>(null);
  const active = dates.includes(focused) ? focused : dates.includes(preferred) ? preferred : dates[0];
  useLayoutEffect(() => {
    if (!pending.current || !dates.includes(pending.current)) return;
    root.current?.querySelector<HTMLElement>(`[data-calendar-date="${pending.current}"]`)?.focus();
    pending.current = null;
  });
  return { root, dateProps: (date: string) => ({
    'data-calendar-date': date,
    tabIndex: date === active ? 0 : -1,
    onFocus: () => setFocused(date),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
      const target = calendarDateTarget(date, event.key, startOfWeek);
      if (!target || (!dates.includes(target) && !onBrowseDate)) return;
      event.preventDefault();
      setFocused(target);
      pending.current = target;
      if (!dates.includes(target) || event.key === 'PageUp' || event.key === 'PageDown') onBrowseDate?.(target);
    },
  }) };
}
