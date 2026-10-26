import type { AppLanguage } from './i18n';

const en = {
  upcoming: 'Upcoming events', noDayEvents: 'No events on this day', openDay: 'Open day',
  more: 'more', nextEvents: 'Show next 60 days', rangeEmpty: 'No events in this period',
  unsaved: 'Discard unsaved changes?', discard: 'Discard changes', keepEditing: 'Keep editing',
  continues: 'Continues', events: 'events', currentTime: 'Current time', hasEvents: 'Events on this day',
};
const translations: Record<AppLanguage, typeof en> = {
  en,
  pl: { upcoming: 'Nadchodzące wydarzenia', noDayEvents: 'Brak wydarzeń w tym dniu', openDay: 'Otwórz dzień',
    more: 'więcej', nextEvents: 'Pokaż kolejne 60 dni', rangeEmpty: 'Brak wydarzeń w tym okresie',
    unsaved: 'Odrzucić niezapisane zmiany?', discard: 'Odrzuć zmiany', keepEditing: 'Kontynuuj edycję',
    continues: 'Kontynuacja', events: 'wydarzenia', currentTime: 'Aktualna godzina', hasEvents: 'Wydarzenia w tym dniu' },
  de: { upcoming: 'Bevorstehende Termine', noDayEvents: 'Keine Termine an diesem Tag', openDay: 'Tag öffnen',
    more: 'weitere', nextEvents: 'Nächste 60 Tage anzeigen', rangeEmpty: 'Keine Termine in diesem Zeitraum',
    unsaved: 'Ungespeicherte Änderungen verwerfen?', discard: 'Änderungen verwerfen', keepEditing: 'Weiter bearbeiten',
    continues: 'Fortsetzung', events: 'Termine', currentTime: 'Aktuelle Uhrzeit', hasEvents: 'Termine an diesem Tag' },
  ru: { upcoming: 'Предстоящие события', noDayEvents: 'В этот день нет событий', openDay: 'Открыть день',
    more: 'ещё', nextEvents: 'Показать следующие 60 дней', rangeEmpty: 'Нет событий за этот период',
    unsaved: 'Отменить несохранённые изменения?', discard: 'Отменить изменения', keepEditing: 'Продолжить редактирование',
    continues: 'Продолжение', events: 'события', currentTime: 'Текущее время', hasEvents: 'События в этот день' },
};
export const calendarText = (language: AppLanguage) => translations[language];
