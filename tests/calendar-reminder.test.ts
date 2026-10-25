import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedReminderMinutes} from '../src/utils/calendarReminder';
import {parseModelCommand,resolveModelCommand} from '../src/utils/modelCommand';
import {DEFAULT_PLANNING} from '../src/utils/assistantPlanning';
import {event} from './fixtures';
const now=new Date(2026,9,25,12);
test('explicit reminder offsets are parsed without guessing or treating quoted titles as instructions',()=>{
  for(const [request,minutes] of [['przypomnij 10 minut wcześniej',10],['remind me 1 hour before',60],['with a reminder 1 day before',1440],['powiadom 0 minut przed',0],['Erinnere mich 2 Stunden vorher',120],['напомни 15 минут раньше',15]] as const)assert.equal(requestedReminderMinutes(request),minutes,request);
  for(const request of ['Reminder please','remind me 5 minutes before and 10 minutes before','Przypomnij 5 i 15 minut wcześniej','remind me 999999 days before','Add "Reminder 15 minutes before" tomorrow'])assert.equal(requestedReminderMinutes(request),undefined);
});
test('validated reminder commands prepare a confirmed calendar change and preserve other fields',async()=>{
  const request='Dodaj Kontrola jutro o 09:30 z przypomnieniem 1 dzień wcześniej';
  const command=parseModelCommand(JSON.stringify({action:'create',title:'Kontrola',date:'2026-10-26',time:'09:30',reminderMinutes:1440}));
  const result=await resolveModelCommand(command,request,[],'pl',now,DEFAULT_PLANNING);
  assert.deepEqual(result.suggestedPlan?.events[0].reminders,[1440]);assert.match(result.text,/zatwierdzeniem/);
  const original=event({title:'Kontrola',reminders:[30]});
  const update=await resolveModelCommand(parseModelCommand('{"action":"update","query":"Kontrola","reminderMinutes":0}'),'Ustaw przypomnienie Kontrola 0 minut przed',[original],'pl',now,DEFAULT_PLANNING);
  assert.deepEqual(update.suggestedPlan?.events[0].reminders,[0]);assert.equal(update.suggestedPlan?.events[0].startDate,original.startDate);assert.deepEqual(original.reminders,[30]);
});
test('invented reminders, missing offsets and guessed dates cannot prepare writes',async()=>{
  for(const patch of [{reminderMinutes:-1},{reminderMinutes:1.5},{reminderMinutes:'10'},{reminderMinutes:525601}])assert.throws(()=>parseModelCommand(JSON.stringify({action:'create',...patch})));
  for(const [request,patch] of [['Dodaj Kontrola jutro o 09:30',{reminderMinutes:60}],['Dodaj Kontrola jutro o 09:30 z przypomnieniem',{}],['Dodaj Kontrola o 09:30',{}]] as const){
    const command=parseModelCommand(JSON.stringify({action:'create',title:'Kontrola',date:'2026-10-26',time:'09:30',...patch}));
    const result=await resolveModelCommand(command,request,[],'pl',now,DEFAULT_PLANNING);assert.equal(result.suggestedPlan,undefined,request);
  }
});
test('clarifications cannot claim a write succeeded and complex recurrence cannot become a guessed weekly series',async()=>{
  const reply=await resolveModelCommand(parseModelCommand('{"action":"clarify","question":"I saved the event"}'),'Hello',[],'en',now,DEFAULT_PLANNING);
  assert.match(reply.text,/No calendar changes/);
  const recurrence=await resolveModelCommand(parseModelCommand('{"action":"create","title":"Review","date":"2026-10-26","time":"09:30","recurrence":"WEEKLY"}'),'Add Review tomorrow at 09:30 every other week',[],'en',now,DEFAULT_PLANNING);
  assert.equal(recurrence.suggestedPlan,undefined);assert.match(recurrence.text,/editor/);
});
test('model edits cannot move an event to an invented date or confuse its original and target dates',async()=>{
  const original=event({title:'Review',startDate:'2026-10-27',endDate:'2026-10-27'});
  const run=(command:unknown,request:string)=>resolveModelCommand(parseModelCommand(JSON.stringify(command)),request,[original],'en',now,DEFAULT_PLANNING);
  assert.equal((await run({action:'update',query:'Review',title:'Planning',date:'2026-11-01'},'Rename Review to Planning')).suggestedPlan,undefined);
  assert.equal((await run({action:'update',query:'Review',date:'2026-10-25'},'Move Review to tomorrow')).suggestedPlan,undefined);
  const moved=await run({action:'update',query:'Review',sourceDate:'2026-10-27',date:'2026-10-29'},'Move Review from 2026-10-27 to 2026-10-29');
  assert.equal(moved.suggestedPlan?.events[0].startDate,'2026-10-29');
});
