import type { CalendarEvent } from '../types';
import type { AssistantPlan } from './assistantPlanning';
import type { AssistantChange } from './calendarStore';
import { validateEvents } from './validation';

export function changesForPlan(plan: AssistantPlan): AssistantChange[] {
  if (!plan.events.length || plan.events.length > 20 || (plan.kind === 'move' && plan.originals.length !== plan.events.length) || (plan.kind === 'create' && plan.originals.length)) throw new Error('Invalid assistant plan');
  const at = Date.now();
  const after: CalendarEvent[] = plan.events.map((draft, i) => {
    if (plan.kind === 'move') return { ...plan.originals[i], ...draft, id: plan.originals[i].id, createdAt: plan.originals[i].createdAt, updatedAt: at } as CalendarEvent;
    return { ...draft, id: crypto.randomUUID(), title: draft.title || 'Event', startDate: draft.startDate!, endDate: draft.endDate || draft.startDate!, allDay: draft.allDay ?? false, color: draft.color || 'lavender', recurrence: draft.recurrence || 'NONE', reminders: draft.reminders || [15], createdAt: at, updatedAt: at };
  });
  validateEvents(after);
  return after.map((event, i) => ({ before: plan.kind === 'move' ? plan.originals[i] : undefined, after: event }));
}
