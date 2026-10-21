/** Normalize supported German command/date grammar; do not translate event names. */
export function normalizeGermanInput(input: string): string {
  let text = input;
  const phrases: [string, string][] = [
    ['doch eine Stunde später', 'actually one hour later'], ['eine Stunde später', 'actually one hour later'],
    ['doch eine Stunde früher', 'actually one hour earlier'], ['eine Stunde früher', 'actually one hour earlier'],
    ['nächste Woche', 'next week'], ['nächsten Monat', 'next month'], ['diese Woche', 'this week'], ['diesen Monat', 'this month'],
    ['wann habe ich frei', 'when am I free'], ['wann habe ich Zeit', 'when am I free'], ['habe ich frei', 'am I free'],
    ['was habe ich', 'what do I have'], ['was steht an', 'what is on'], ['was steht', 'what is on'], ['mein Terminplan', 'my schedule'],
    ['prüfe Überschneidungen', 'check conflicts'], ['prüfe Konflikte', 'check conflicts'],
    ['Zusammenfassung dieser Woche', 'summary this week'], ['für eine Stunde', 'for 1 hour'], ['für eine halbe Stunde', 'for 30 minutes'],
    ['jeden Tag', 'every day'], ['jede Woche', 'every week'], ['jeden Monat', 'every month'],
    ['ganzen Tag', 'all day'], ['ganztägig', 'all day'],
    ['am Montag', 'on Monday'], ['am Dienstag', 'on Tuesday'], ['am Mittwoch', 'on Wednesday'],
    ['am Donnerstag', 'on Thursday'], ['am Freitag', 'on Friday'], ['am Samstag', 'on Saturday'], ['am Sonntag', 'on Sunday'],
    ['auf Montag', 'to Monday'], ['auf Dienstag', 'to Tuesday'], ['auf Mittwoch', 'to Wednesday'],
    ['auf Donnerstag', 'to Thursday'], ['auf Freitag', 'to Friday'], ['auf Samstag', 'to Saturday'], ['auf Sonntag', 'to Sunday'],
  ];
  for (const [from, to] of phrases) text = text.replace(new RegExp(`(?<![\\p{L}])${from}(?![\\p{L}])`, 'giu'), to);
  const counts: Record<string, number> = { einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5 };
  text = text.replace(/\bum\s+(\d{1,2}(?::\d{2})?)(?:\s+Uhr)?/giu, 'at $1')
    .replace(/\bfür\s+(\d+|eine|zwei|drei|vier|fünf)\s+(Minuten?|Stunden?)/giu,
      (_, n, unit) => `for ${n.toLowerCase() === 'eine' ? 1 : counts[n.toLowerCase()] || n} ${unit.toLowerCase().startsWith('min') ? 'minutes' : 'hours'}`)
    .replace(/\bin\s+(\d+|einem|einer|zwei|drei|vier|fünf)\s+(Tagen?|Wochen?)/giu,
      (_, n, unit) => `in ${counts[n.toLowerCase()] || n} ${unit.toLowerCase().startsWith('woch') ? 'weeks' : 'days'}`)
    .replace(/\bam\s+(\d{1,2})\.\s*/giu, '$1 ')
    .replace(/\b(?:füge|fügen)\s+/giu, 'Add ').replace(/\bhinzu\s*([.!?]?)$/giu, '$1');
  const words: Record<string, string> = {
    plane: 'Schedule', erstelle: 'Create', suche: 'Find', finde: 'Find', verschiebe: 'Move', zeige: 'Show',
    heute: 'today', morgen: 'tomorrow', übermorgen: 'day after tomorrow',
    montag: 'Monday', dienstag: 'Tuesday', mittwoch: 'Wednesday', donnerstag: 'Thursday', freitag: 'Friday', samstag: 'Saturday', sonntag: 'Sunday',
    januar: 'January', februar: 'February', märz: 'March', april: 'April', mai: 'May', juni: 'June', juli: 'July',
    august: 'August', september: 'September', oktober: 'October', november: 'November', dezember: 'December',
    wochenende: 'weekend', wochenendes: 'weekend', woche: 'week', monat: 'month',
    zwei: 'two', drei: 'three', vier: 'four', fünf: 'five', einstündige: 'one-hour', einstündigen: 'one-hour',
    frei: 'free time', hallo: 'hello', danke: 'thanks', auf: 'to', bis: 'to', von: 'from',
  };
  return text.replace(/[\p{L}]+/gu, word => words[word.toLowerCase()] || word);
}
