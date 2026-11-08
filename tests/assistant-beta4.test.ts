import test from 'node:test';
import assert from 'node:assert/strict';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { parseCalendarCommand, calendarFields, parseCalendarBatch } from '../src/utils/calendarCommandParser';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { changesForPlan } from '../src/utils/assistantChanges';
import { parseModelCommand, resolveModelCommand } from '../src/utils/modelCommand';
import { guardCalendarWriteClaim } from '../src/utils/calendarWriteClaim';
import { DEFAULT_MODEL } from '../src/utils/modelRegistry';
import { generationPlan, generationPreference, saveGenerationPreference } from '../src/utils/generationSettings';
import type { CalendarEvent } from '../src/types';
const now=new Date(2026,10,7,10,0),values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
const original:CalendarEvent={id:'stable-id',title:'NIGERRR',startDate:'2026-11-12',endDate:'2026-11-12',startTime:'07:59',endTime:'08:32',allDay:false,color:'banana',reminders:[15],recurrence:'NONE',location:'Room',description:'keep',createdAt:1,updatedAt:1};
const run=(q:string,events:CalendarEvent[]=[],context={})=>runModelAssistant(q,events,'pl',now,context,DEFAULT_PLANNING);
test('reported typo, quoted title and godziny range produce a complete unsaved draft',async()=>{
 const q='Dodaj wydażenie na 9 listopada, «granie», od godziny 18:35 do godziny 20:01.';
 assert.equal(calendarFields(q,now).time,'18:35');
 const r=await run(q),e=r.suggestedPlan?.events[0];assert.ok(e,r.text);
 assert.deepEqual([e.title,e.startDate,e.startTime,e.endTime],['granie','2026-11-09','18:35','20:01']);
});
test('PL/EN create, durations, all-day and optional explicit properties remain validated',async()=>{
 for(const [q,title,end] of [['Add event Workout tomorrow at 18.35 for one hour','Workout','19:35'],['Dodaj Test jutro o 15:00 na godzinę','Test','16:00']] as const){const r=await run(q);assert.equal(r.suggestedPlan?.events[0].title,title);assert.equal(r.suggestedPlan?.events[0].endTime,end);}
 const day=await run('Dodaj Test jutro cały dzień');assert.equal(day.suggestedPlan?.events[0].allDay,true);
 const c=await run('Dodaj Test jutro o 15:00, kolor: Banan, opis: zabrać książkę, z przypomnieniem 10 minut przed');
 assert.equal(c.suggestedPlan?.events[0].color,'banana');assert.deepEqual(c.suggestedPlan?.events[0].reminders,[10]);
});
test('date-qualified lookup, edit and deletion identify the same stable event',async()=>{
 const events=[structuredClone(original)],snapshot=JSON.stringify(events);
 const found=await run('Co mam 12 listopada?',events);assert.match(found.text,/NIGERRR/);
 for(const q of ['Przesuń NIGERRR z 12.11.2026 na 09:15–10:30','Przesuń NIGERRR z 12.11.2026 na 09:15']){
  const r=await run(q,events),plan=r.suggestedPlan;assert.ok(plan,r.text);assert.equal(plan.originals[0].id,original.id);
  const change=changesForPlan(plan)[0];assert.equal(change.after!.id,original.id);assert.equal(change.after!.startTime,'09:15');assert.equal(change.after!.endTime,q.endsWith('10:30')?'10:30':'09:48');
  for(const key of ['color','reminders','description','location','createdAt'] as const)assert.deepEqual(change.after![key],original[key]);
 }
 const deletion=await run('Usuń NIGERRR z 12 listopada',events);assert.equal(deletion.suggestedPlan?.originals[0].id,original.id);assert.equal(changesForPlan(deletion.suggestedPlan!)[0].after,undefined);assert.equal(JSON.stringify(events),snapshot);
});
test('source and target dates are distinct; ambiguous titles never select an arbitrary record',async()=>{
 const moved=await run('Move NIGERRR from 12 November to 13 November at 09:15',[original]);assert.equal(moved.suggestedPlan?.events[0].startDate,'2026-11-13');
 const r=await run('Usuń NIGERRR',[original,{...original,id:'second'}]);assert.equal(r.suggestedPlan,undefined);
 const none=await run('Usuń Missing jutro',[original]);assert.equal(none.suggestedPlan,undefined);
});
test('a complete three-event batch is proposed together; incomplete batches never partly execute',async()=>{
 const q='Utwórz trzy wydarzenia: A 10 listopada o 10:00; B 11 listopada o 11:00; C 12 listopada o 12:00';
 assert.equal(parseCalendarBatch(q,'pl',now)?.length,3);
 const r=await run(q);assert.equal(r.suggestedPlan?.events.length,3);assert.deepEqual(changesForPlan(r.suggestedPlan!).map(c=>c.after!.startDate),['2026-11-10','2026-11-11','2026-11-12']);
 const incomplete=await run(q.replace('C 12 listopada o 12:00','C'));assert.equal(incomplete.suggestedPlan,undefined);
 const cancel=await run('Zapomnij o tej propozycji, nic nie zapisuj',[],r.context);assert.equal(cancel.suggestedPlan,undefined);assert.equal(cancel.context.proposal,undefined);
});
test('read-only availability, after-hour queries and ordinal references use the actual supplied calendar',async()=>{
 const yoga=[{...original,id:'y1',title:'Yoga'},{...original,id:'y2',title:'Yoga',startTime:'18:30',endTime:'19:30'}];
 const found=await run('Znajdź Yoga',yoga);assert.equal(found.context.searchResults?.length,2);
 const second=await run('Nie, chodziło mi o to drugie spotkanie.',yoga,found.context);assert.equal(second.context.reference?.id,'y2');
 const moved=await run('Przesuń je na 13 listopada o 09:15',yoga,second.context);assert.equal(moved.suggestedPlan?.originals[0].id,'y2');
 const after=await run('Czy mam cokolwiek 12 listopada po 18?',yoga);assert.match(after.text,/18:30/);assert.doesNotMatch(after.text,/07:59/);assert.equal(after.suggestedPlan,undefined);
 const free=await run('Am I free on Tuesday morning?',yoga);assert.match(free.text,/2026-11-10/);assert.equal(free.suggestedPlan,undefined);
});
test('false model write claims cannot report a successful operation',async()=>{
 for(const text of ['I have created the Yoga event in your calendar.','Dodano wydarzenie Yoga.','Wydarzenie zostało dodane.'])assert.match(guardCalendarWriteClaim(text,'en'),/No calendar changes/);
 assert.equal(guardCalendarWriteClaim('null is a valid JSON value.','en'),'null is a valid JSON value.');
 await assert.rejects(async()=>parseModelCommand('{"action":"delete","unexpected":true}'));
});
test('generation is bounded by context, persistent per model, and overridden only for explicit tests',()=>{
 values.clear();const b={...DEFAULT_MODEL,id:'second',sha256:'f'.repeat(64)};
 const messages=[{content:'helpful assistant'},{content:'Write 300–500 words'}];
 assert.ok(generationPlan(DEFAULT_MODEL,'Write 300–500 words',false,undefined,2048,messages).maxOutputTokens>=900);
 saveGenerationPreference(DEFAULT_MODEL,{mode:'manual',tokens:1500});saveGenerationPreference(b,{mode:'manual',tokens:700});
 assert.equal(generationPreference(DEFAULT_MODEL).mode,'manual');assert.equal(generationPlan(b,'x',false,undefined,2048,messages).maxOutputTokens,700);
 const benchmark=generationPlan(DEFAULT_MODEL,'x',false,96,2048,messages);assert.equal(benchmark.maxOutputTokens,96);assert.equal(benchmark.outputLimitSource,'override');
 const limited=generationPlan(DEFAULT_MODEL,'x',false,undefined,512,messages);assert.equal(limited.contextLimited,true);
 for(const n of [0,-1,4097,NaN,1.5])assert.throws(()=>saveGenerationPreference(b,{mode:'manual',tokens:n}));
});

test('batch conflicts are reported and a lookup can find an exact short or partial title',async()=>{
 const r=await run('Create three events: Alpha 10 November at 10:00; Beta 10 November at 10:30; Gamma 12 November at 12:00');assert.match(r.text,/conflict/i);assert.equal(r.suggestedPlan?.events.length,3);
 const one={...original,title:'A'};const result=await run('Delete A on 12 November',[one]);assert.equal(result.suggestedPlan?.originals[0].id,one.id);
 const partial=await run('Find NIGE',[original]);assert.match(partial.text,/NIGERRR/);
});

test('word-form dates and explicit disambiguation preserve the chosen stable ID',async()=>{
 for(const q of ['Dodaj Test dziewiątego listopada o 15:00','Add Test November ninth at 15:00']){const r=await run(q);assert.equal(r.suggestedPlan?.events[0].startDate,'2026-11-09');}
 const events=[{...original,id:'first',title:'Yoga'},{...original,id:'second',title:'Yoga',startTime:'12:00',endTime:'13:00'}];
 const ask=await run('Usuń Yoga',events);assert.equal(ask.suggestedPlan,undefined);assert.equal(ask.context.searchResults?.length,2);
 const chosen=await run('2',events,ask.context);assert.equal(chosen.suggestedPlan?.originals[0].id,'second');
 const cancelled=await run('Zapomnij o tej propozycji, nic nie zapisuj',events,ask.context);assert.equal(cancelled.context.pendingChoice,undefined);
});
