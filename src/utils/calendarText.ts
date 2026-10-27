import type { AppLanguage } from './i18n';

const en = {
  upcoming: 'Upcoming events', noDayEvents: 'No events on this day', openDay: 'Open day',
  more: 'more', nextEvents: 'Show next 60 days', rangeEmpty: 'No events in this period',
  unsaved: 'Discard unsaved changes?', discard: 'Discard changes', keepEditing: 'Keep editing',
  continues: 'Continues', events: 'events', currentTime: 'Current time', hasEvents: 'Events on this day',
  dateKeys: 'Arrow keys move between dates. Home and End move to the week boundaries. Page Up and Page Down change month. Enter selects a date.',
  timeKeys: 'Arrow keys move between time cells. Home and End move to the first and last time. Enter creates an event. Use the period buttons or A and D to change period.',
  agendaKeys: 'Up and Down move between list entries. Home and End move to the first and last entry. Enter opens the date or event.',
};
const translations: Record<AppLanguage, typeof en> = {
  en,
  pl: { upcoming: 'Nadchodzące wydarzenia', noDayEvents: 'Brak wydarzeń w tym dniu', openDay: 'Otwórz dzień',
    more: 'więcej', nextEvents: 'Pokaż kolejne 60 dni', rangeEmpty: 'Brak wydarzeń w tym okresie',
    unsaved: 'Odrzucić niezapisane zmiany?', discard: 'Odrzuć zmiany', keepEditing: 'Kontynuuj edycję',
    continues: 'Kontynuacja', events: 'wydarzenia', currentTime: 'Aktualna godzina', hasEvents: 'Wydarzenia w tym dniu',
    dateKeys: 'Strzałki przenoszą fokus między datami. Home i End przechodzą do granic tygodnia. Page Up i Page Down zmieniają miesiąc. Enter wybiera datę.',
    timeKeys: 'Strzałki przenoszą fokus między komórkami czasu. Home i End przechodzą do pierwszej i ostatniej godziny. Enter tworzy wydarzenie. Przyciski okresu lub A i D zmieniają okres.',
    agendaKeys: 'Strzałki w górę i w dół przenoszą fokus między pozycjami listy. Home i End przechodzą do pierwszej i ostatniej pozycji. Enter otwiera datę lub wydarzenie.' },
  de: { upcoming: 'Bevorstehende Termine', noDayEvents: 'Keine Termine an diesem Tag', openDay: 'Tag öffnen',
    more: 'weitere', nextEvents: 'Nächste 60 Tage anzeigen', rangeEmpty: 'Keine Termine in diesem Zeitraum',
    unsaved: 'Ungespeicherte Änderungen verwerfen?', discard: 'Änderungen verwerfen', keepEditing: 'Weiter bearbeiten',
    continues: 'Fortsetzung', events: 'Termine', currentTime: 'Aktuelle Uhrzeit', hasEvents: 'Termine an diesem Tag',
    dateKeys: 'Pfeiltasten bewegen den Fokus zwischen Daten. Pos1 und Ende springen zu den Wochengrenzen. Bild auf und Bild ab wechseln den Monat. Eingabe wählt ein Datum.',
    timeKeys: 'Pfeiltasten bewegen den Fokus zwischen Uhrzeiten. Pos1 und Ende springen zur ersten und letzten Uhrzeit. Eingabe erstellt einen Termin. Zeitraumtasten oder A und D wechseln den Zeitraum.',
    agendaKeys: 'Auf und Ab bewegen den Fokus zwischen Listeneinträgen. Pos1 und Ende springen zum ersten und letzten Eintrag. Eingabe öffnet das Datum oder den Termin.' },
  ru: { upcoming: 'Предстоящие события', noDayEvents: 'В этот день нет событий', openDay: 'Открыть день',
    more: 'ещё', nextEvents: 'Показать следующие 60 дней', rangeEmpty: 'Нет событий за этот период',
    unsaved: 'Отменить несохранённые изменения?', discard: 'Отменить изменения', keepEditing: 'Продолжить редактирование',
    continues: 'Продолжение', events: 'события', currentTime: 'Текущее время', hasEvents: 'События в этот день',
    dateKeys: 'Стрелки перемещают фокус между датами. Home и End переходят к границам недели. Page Up и Page Down меняют месяц. Enter выбирает дату.',
    timeKeys: 'Стрелки перемещают фокус между ячейками времени. Home и End переходят к первому и последнему времени. Enter создаёт событие. Кнопки периода или A и D меняют период.',
    agendaKeys: 'Вверх и вниз перемещают фокус между элементами списка. Home и End переходят к первому и последнему элементу. Enter открывает дату или событие.' },
};
export const calendarText = (language: AppLanguage) => translations[language];
