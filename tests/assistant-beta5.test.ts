import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarBatch, parseCalendarCommand } from '../src/utils/calendarCommandParser';
import { parseModelCommand, resolveModelCommand } from '../src/utils/modelCommand';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import { changesForPlan } from '../src/utils/assistantChanges';
import { diagnosticsReport } from '../src/utils/modelDiagnostics';
import { event } from './fixtures';
import { batchCases,editCases } from './fixtures/beta5-cases';
const now=new Date(2026,10,7,10);
const values=new Map();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)},configurable:true});
const original=event({id:'stable-beta5',title:'TEST BETA 4',startDate:'2026-11-12',endDate:'2026-11-12',startTime:'08:00',endTime:'09:00',color:'banana',description:'keep',reminders:[15]});
for(const [language,request,count]of batchCases)test('reported batch '+language+' '+batchCases.findIndex(c=>c[1]===request),async()=>{
 const parsed=parseCalendarBatch(request,language,now);assert.equal(parsed?.length,count,'Batch must be recognized before inference');
 const result=await runModelAssistant(request,[],language,now,{},DEFAULT_PLANNING);assert.equal(result.route,'rules');assert.equal(result.suggestedPlan?.events.length,count,result.text);
 assert.deepEqual(changesForPlan(result.suggestedPlan!).map(c=>[c.after!.title,c.after!.startDate,c.after!.startTime,c.after!.endTime]),Array.from({length:count},(_,i)=>['TEST '+String.fromCharCode(65+i),`2026-11-${13+i}`,`${10+2*i}:00`,`${11+2*i}:00`]));
});
for(const [language,request]of editCases)test('reported edit '+language+' '+editCases.findIndex(c=>c[1]===request),async()=>{
 assert.ok(parseCalendarCommand(request,language,now),'Concrete edit must route without a model');
 const result=await runModelAssistant(request,[structuredClone(original)],language,now,{},DEFAULT_PLANNING),plan=result.suggestedPlan;assert.ok(plan,result.text);
 const after=changesForPlan(plan)[0].after!;assert.equal(after.id,original.id);assert.equal(after.startDate,original.startDate);assert.equal(after.startTime,'09:15');assert.equal(after.endTime,'10:30');assert.equal(after.description,'keep');assert.deepEqual(after.reminders,[15]);
});
test('whole-message validation reproduces the erroneous clock comparison without exposing values',async()=>{
 const trace:any={operationCount:3};
 const result=await resolveModelCommand(parseModelCommand('{"action":"create","title":"TEST B","date":"2026-11-14","time":"12:00","endTime":"13:00"}'),batchCases[0][1],[],'pl',now,DEFAULT_PLANNING,undefined,trace);
 assert.equal(result.suggestedPlan,undefined);assert.equal(trace.field,'time');assert.equal(trace.code,'unrequested-field');assert.equal(trace.stage,'field-validation');assert.equal(trace.expectedType,'requested-time');assert.equal(trace.receivedType,'string');assert.equal(trace.operationCount,3);assert.doesNotMatch(JSON.stringify(trace),/TEST|2026|12:00/);
});
test('a model cannot introduce a name, date, clock, location, recurrence or all-day flag',async()=>{
 const request='Add event PRIVATE_TITLE on 2026-11-13 from 10:00 to 11:00';
 for(const patch of [{title:'INVENTED'},{date:'2026-11-14'},{time:'12:00'},{endTime:'15:00'},{location:'SECRET_LOCATION'},{recurrence:'DAILY'},{allDay:true}]){
  const trace:any={operationCount:1};const command=parseModelCommand(JSON.stringify({action:'create',title:'PRIVATE_TITLE',date:'2026-11-13',time:'10:00',endTime:'11:00',...patch}));
  const result=await resolveModelCommand(command,request,[],'en',now,DEFAULT_PLANNING,undefined,trace);assert.equal(result.suggestedPlan,undefined);assert.ok(trace.field);assert.doesNotMatch(JSON.stringify(trace),/PRIVATE_TITLE|SECRET_LOCATION|INVENTED|2026/);
 }
});
test('incomplete or count-mismatched batches remain wholly uncommittable',async()=>{
 for(const request of ['Add three events: A tomorrow at 10:00 and B tomorrow at 12:00','Add two events: A tomorrow at 10:00 and B tomorrow','Add two events: A tomorrow at 10:00 and Delete B tomorrow at 12:00']){
  const result=await runModelAssistant(request,[],'en',now,{},DEFAULT_PLANNING);assert.equal(result.suggestedPlan,undefined);
 }
 const result=await runModelAssistant(batchCases[1][1],[],'pl',now,{},DEFAULT_PLANNING);assert.ok(result.suggestedPlan);const validation=(diagnosticsReport().turns.at(-1) as any).validation;assert.equal(validation.operationCount,2);assert.equal(validation.stage,'proposal-ready');
});
test('quoted punctuation and Oxford commas do not change the operation list or bind fields across events',async()=>{
 const request='Add two events: “ROCK, AND ROLL” on 2026-11-13 from 10:00 to 11:00, and “B” on 2026-11-14 from 12:00 to 13:00.';
 const parsed=parseCalendarBatch(request,'en',now)!;assert.equal(parsed.length,2);assert.equal(parsed[0].command.title,'ROCK, AND ROLL');
 for(const patch of [{date:parsed[1].command.date},{time:parsed[1].command.time}]){
  const diagnostic:any={operationCount:2};const result=await resolveModelCommand({...parsed[0].command,...patch},parsed[0].request,[],'en',now,DEFAULT_PLANNING,undefined,diagnostic);assert.equal(result.suggestedPlan,undefined);assert.ok(diagnostic.field);
 }
});
