import { CalendarEvent } from '../types';

/**
 * Algorytm Meeusa/Jonesa/Butchera do precyzyjnego wyznaczania daty Wielkanocy
 * dla dowolnego roku w kalendarzu gregoriańskim.
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export interface PolishHoliday {
  date: string;
  name: string;
  isFreeDay: boolean;
}

/**
 * Zwraca listę wszystkich oficjalnych świąt i dni ustawowo wolnych w Polsce dla danego roku.
 */
export function getPolishHolidays(year: number): PolishHoliday[] {
  const holidays: PolishHoliday[] = [
    { date: `${year}-01-01`, name: 'Nowy Rok', isFreeDay: true },
    { date: `${year}-01-06`, name: 'Święto Trzech Króli', isFreeDay: true },
    { date: `${year}-05-01`, name: 'Święto Pracy', isFreeDay: true },
    { date: `${year}-05-03`, name: 'Święto Konstytucji 3 Maja', isFreeDay: true },
    { date: `${year}-08-15`, name: 'Wniebowzięcie NMP / Święto Wojska Polskiego', isFreeDay: true },
    { date: `${year}-11-01`, name: 'Wszystkich Świętych', isFreeDay: true },
    { date: `${year}-11-11`, name: 'Narodowe Święto Niepodległości', isFreeDay: true },
    { date: `${year}-12-25`, name: 'Boże Narodzenie (pierwszy dzień)', isFreeDay: true },
    { date: `${year}-12-26`, name: 'Boże Narodzenie (drugi dzień)', isFreeDay: true },
  ];

  // Święta ruchome na bazie Wielkanocy
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);

  // Niedziela Wielkanocna
  holidays.push({
    date: `${year}-${pad2(easter.month)}-${pad2(easter.day)}`,
    name: 'Wielkanoc',
    isFreeDay: true,
  });

  // Poniedziałek Wielkanocny (+1 dzień)
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterMonday.getDate() + 1);
  holidays.push({
    date: `${year}-${pad2(easterMonday.getMonth() + 1)}-${pad2(easterMonday.getDate())}`,
    name: 'Poniedziałek Wielkanocny',
    isFreeDay: true,
  });

  // Zielone Świątki (+49 dni po Wielkanocy)
  const pentecost = new Date(easterDate);
  pentecost.setDate(pentecost.getDate() + 49);
  holidays.push({
    date: `${year}-${pad2(pentecost.getMonth() + 1)}-${pad2(pentecost.getDate())}`,
    name: 'Zielone Świątki',
    isFreeDay: true,
  });

  // Boże Ciało (+60 dni po Wielkanocy)
  const corpusChristi = new Date(easterDate);
  corpusChristi.setDate(corpusChristi.getDate() + 60);
  holidays.push({
    date: `${year}-${pad2(corpusChristi.getMonth() + 1)}-${pad2(corpusChristi.getDate())}`,
    name: 'Boże Ciało',
    isFreeDay: true,
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Konwertuje polskie święta na obiekty CalendarEvent gotowe do zapisania w kalendarzu.
 */
export function generateHolidayEvents(years: number[] = [2025, 2026, 2027]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  years.forEach((yr) => {
    const list = getPolishHolidays(yr);
    list.forEach((h) => {
      events.push({
        id: `pl-holiday-${h.date}`,
        title: `🇵🇱 ${h.name}`,
        startDate: h.date,
        endDate: h.date,
        allDay: true,
        color: 'banana', // słoneczny/żółty
        description: 'Oficjalne święto ustawowo wolne od pracy w Polsce.',
        reminders: [],
        recurrence: 'NONE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  return events;
}
