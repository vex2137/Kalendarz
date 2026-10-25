import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRecords} from '../training/generate';
import {validateRecords} from '../training/validate';
import {parseModelCommand} from '../src/utils/modelCommand';
test('SFT examples validate the real command contract and keep paraphrase groups within one split',()=>{
  const records=generateRecords();assert.equal(records.length,432);assert.ok(validateRecords(records).families>30);
  const groups=new Map<string,Set<string>>();for(const row of records){if(!groups.has(row.family))groups.set(row.family,new Set());groups.get(row.family)!.add(row.split);}
  assert.ok([...groups.values()].every(splits=>splits.size===1));
  for(const category of ['absolute','relative','times','update','delete','search','recurrence','reminders','clarification','invalid','tools','typos'])assert.equal(records.filter(r=>r.category===category).length,36);
  assert.ok(records.some(r=>r.timezone==='America/New_York'));assert.ok(records.some(r=>r.current_time.startsWith('2028-02-28')));
  const leap=records.find(r=>r.id==='relative-1-en-1')!;assert.equal(parseModelCommand(leap.messages[2].content).date,'2028-02-29');
  const year=records.find(r=>r.id==='relative-1-pl-0')!;assert.equal(parseModelCommand(year.messages[2].content).date,'2027-01-01');
});
test('SFT validator rejects duplicate records, prompt leakage and invalid calendar targets',()=>{
  const [first,...rest]=generateRecords();
  assert.throws(()=>validateRecords([first,first]),/Duplicate/);
  assert.throws(()=>validateRecords([first,{...rest[0],family:first.family,split:'test'}]),/leakage/);
  assert.throws(()=>validateRecords([{...first,messages:[...first.messages.slice(0,2),{role:'assistant',content:'{"action":"create","date":"2026-02-30"}'}]}]),/date/);
  assert.throws(()=>validateRecords([{...first,messages:[...first.messages.slice(0,2),{role:'assistant',content:'{"action":"chat","reply":"Saved it"}'}]}]),/claim/);
});
