import type { CalendarOccurrence } from './recurrence';
export function layoutOverlaps<T extends CalendarOccurrence>(items: T[], minimumDuration = 0) {
  type Positioned = T & { column: number; columns: number };
  const result: Positioned[] = [];
  let group: Positioned[] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const finish = () => {
    for (const item of group) item.columns = ends.length;
    result.push(...group);
    group = [];
    ends = [];
  };
  for (const item of [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes,
  )) {
    if (item.startMinutes >= groupEnd) finish();
    const displayEnd = Math.max(item.endMinutes, item.startMinutes + minimumDuration);
    let column = ends.findIndex((end) => end <= item.startMinutes);
    if (column < 0) column = ends.length;
    ends[column] = displayEnd;
    groupEnd = Math.max(groupEnd, displayEnd);
    group.push({ ...item, column, columns: 1 });
  }
  finish();
  return result;
}
