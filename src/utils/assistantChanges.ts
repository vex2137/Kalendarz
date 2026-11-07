import type { CalendarEvent } from '../types';
import type { AssistantPlan } from './assistantPlanning';
import type { AssistantChange } from './calendarStore';
import { validateEvents } from './validation';
import { buildEventIndex } from './recurrence';
import { addDays } from './dates';

export function planHasConflicts(plan:AssistantPlan,events:CalendarEvent[]){
  if(plan.kind==='delete')return false;
  const added=changesForPlan(plan).flatMap(c=>c.after?[c.after]:[]),ids=new Set(added.map(e=>e.id));
  const existing=events.filter(e=>!plan.originals.some(o=>o.id===e.id));
  const from=added.map(e=>e.startDate).sort()[0],last=added.map(e=>e.endDate).sort().at(-1)!;
  const until=last<addDays(from,366)?last:addDays(from,366);
  for(const bucket of buildEventIndex([...existing,...added],from,until).values()){
    for(let i=0;i<bucket.length;i++)for(let j=i+1;j<bucket.length;j++){
      const a=bucket[i],b=bucket[j];
      if((ids.has(a.event.id)||ids.has(b.event.id))&&a.event.id!==b.event.id&&(a.event.allDay||b.event.allDay||a.startMinutes<b.endMinutes&&b.startMinutes<a.endMinutes))return true;
    }
  }
  return false;
}

export function changesForPlan(plan: AssistantPlan): AssistantChange[] {
  if (!['create', 'move', 'delete'].includes(plan.kind)) throw new Error('Invalid assistant action');
  if (plan.kind === 'delete') {
    if (plan.originals.length !== 1 || plan.events.length !== 1 || plan.events[0].id !== plan.originals[0].id) throw new Error('Invalid assistant deletion');
    validateEvents(plan.originals);
    return plan.originals.map(before => ({ before }));
  }
  if (!plan.events.length || plan.events.length > 20 || (plan.kind === 'move' && plan.originals.length !== plan.events.length) || (plan.kind === 'create' && plan.originals.length)) throw new Error('Invalid assistant plan');
  const at = Date.now();
  const after: CalendarEvent[] = plan.events.map((draft, i) => {
    if (plan.kind === 'move') return { ...plan.originals[i], ...draft, id: plan.originals[i].id, createdAt: plan.originals[i].createdAt, updatedAt: at } as CalendarEvent;
    return { ...draft, id: crypto.randomUUID(), title: draft.title || 'Event', startDate: draft.startDate!, endDate: draft.endDate || draft.startDate!, allDay: draft.allDay ?? false, color: draft.color || 'lavender', recurrence: draft.recurrence || 'NONE', reminders: draft.reminders || [15], createdAt: at, updatedAt: at };
  });
  validateEvents(after);
  return after.map((event, i) => ({ before: plan.kind === 'move' ? plan.originals[i] : undefined, after: event }));
}
