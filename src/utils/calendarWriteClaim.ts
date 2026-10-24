import type { AppLanguage } from './i18n';
// Generated text is never evidence of a completed transaction. Apply only to
// model conversation, not literal event titles or search results.
export function guardCalendarWriteClaim(text:string,language:AppLanguage) {
  const claim=/\bchanges? (?:have been )?saved\b|\b(?:i|i've|i have) (?:successfully )?(?:saved|added|created|deleted|removed|updated) (?:the |your |an? )?(?:event|appointment|changes)\b|zapisano zmiany|(?:dodałem|dodałam|zapisałem|zapisałam|usunąłem|usunęłam) (?:wydarzenie|zmiany)|изменения сохранены|(?:добавил|добавила|удалил|удалила) событие|[äa]nderungen gespeichert|ich habe (?:den |einen )?termin (?:gespeichert|gel[öo]scht|erstellt)/iu;
  if(!claim.test(text))return text;
  return ({en:'No calendar changes were made by this reply. Review and explicitly confirm a proposed change before it can be saved.',pl:'Ta odpowiedź nie zmieniła kalendarza. Przed zapisem sprawdź propozycję i jawnie ją zatwierdź.',de:'Diese Antwort hat den Kalender nicht geändert. Prüfe und bestätige einen Vorschlag ausdrücklich, bevor er gespeichert wird.',ru:'Этот ответ не изменил календарь. Проверьте и явно подтвердите предложение перед сохранением.'})[language];
}
