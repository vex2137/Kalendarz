const formatters = new Map<string, Intl.DateTimeFormat>();
/** Resolve a wall clock in an IANA zone without assuming the machine's zone. */
export function zonedDateTime(date: string, time: string, zone?: string): Date {
  if (!zone || zone === 'floating') return new Date(`${date}T${time}:00`);
  if (zone === 'UTC' || zone === 'Z') return new Date(`${date}T${time}:00Z`);
  const target = Date.parse(`${date}T${time}:00Z`);
  let instant = target;
  const formatter =
    formatters.get(zone) ||
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  formatters.set(zone, formatter);
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
    );
    const represented = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    const correction = target - represented;
    instant += correction;
    if (!correction) break;
  }
  return new Date(instant);
}

export function wallDateTime(instant: Date, zone?: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      ...(zone ? { timeZone: zone } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
