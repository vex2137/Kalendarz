import { calendarFields } from './calendarCommandParser';
import type { ModelConversation } from './modelAssistant';

export function needsCalendarExtraction(query: string, now: Date, context: ModelConversation) {
  // A date or a pronoun alone is not an instruction to operate on the calendar.
  const explicit = /(?<![\p{L}])(?:dod\p{L}*|utw[oó]rz\p{L}*|wpisz|zapisz|zaplanuj|przenie\p{L}*|prze[lł]o[zż]\p{L}*|przesu\p{L}*|zmie\p{L}*|usu\p{L}*|skas\p{L}*|odwo\p{L}*|znajd\p{L}*|szuk\p{L}*|wyszuk\p{L}*|kolizj\p{L}*|konflikt\p{L}*|propozycj\p{L}*|add|create|schedule|move|reschedule|rename|change|delete|remove|cancel|find|search|conflicts|appointment|events?|wydarzeni\p{L}*|termin|termine|verschiebe|lösche|добавь|удали|перенеси|событие)(?![\p{L}])/iu.test(query);
  if (explicit) return true;
  const fields = calendarFields(query, now);
  const temporal = Boolean(fields.date || fields.time || fields.duration || fields.allDay);
  if (temporal && /^(?:co mam|jak wygl[aą]da|kiedy|czy mam|what|when|am i|do i|show my)\b/iu.test(query.trim())) return true;
  if (/\b(?:woln\p{L}*|availability|available)\b|\b(?:am i|when.*|do i have) free\b/iu.test(query)) return true;
  if (context.pending && temporal && !fields.invalid && !fields.rest) return true;
  return Boolean((context.reference || context.proposal) && /\b(?:duration|trwa|d[lł]ugo[sś][cć])\b/iu.test(query));
}
