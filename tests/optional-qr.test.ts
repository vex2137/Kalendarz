import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeUnprotectedSync,encodeSync,decodeSync,QRAssembler,isEncryptedSync} from '../src/utils/sync';
import {serializeICS,parseICSToEvents} from '../src/utils/storage';
import {event} from './fixtures';
const payload=(n:number)=>({v:2 as const,app:'cal-offline' as const,events:Array.from({length:n},(_,i)=>event({id:`qr-${i}`,title:`Żółć i gęślą jaźń ${i}`,description:'Opis\nĆwiczenia, „tekst”',location:'Łódź',reminders:[5,15],timeZone:'Europe/Warsaw'})),deletions:[]});
test('explicit unprotected KAL2 round trip preserves empty/many events and fields without password',async()=>{
 for(const n of [0,1,100]){const p=payload(n),encoded=await encodeUnprotectedSync(p);assert.equal(isEncryptedSync(encoded.code),false);assert.match(encoded.code,/^KAL2:/);assert.deepEqual(await decodeSync(encoded.code),p);const a=new QRAssembler();let code='';for(const frame of [...encoded.frames].reverse())code=a.add(frame).code||code;assert.deepEqual(await decodeSync(code),p);}
});
test('password protection can be enabled again; no implicit downgrade for empty/short password',async()=>{
 const p=payload(2);await assert.rejects(encodeSync(p,''));await assert.rejects(encodeSync(p,'short'));
 const protectedCode=await encodeSync(p,'Sekret do QR 123!');assert.equal(isEncryptedSync(protectedCode.code),true);await assert.rejects(decodeSync(protectedCode.code));assert.deepEqual(await decodeSync(protectedCode.code,'Sekret do QR 123!'),p);
});
test('unprotected corrupt/invalid payloads are rejected without partial import',async()=>{
 await assert.rejects(encodeUnprotectedSync({...payload(1),events:[{id:'invalid'} as any]}));
 const p=await encodeUnprotectedSync(payload(3));await assert.rejects(decodeSync(p.code.replace(/^KAL2:./,'KAL2:'+ (p.code[5]==='0'?'1':'0'))));
});
test('ICS export/import preserves Polish fields, times and empty/multiple calendars',()=>{
 for(const n of [0,1,40]){const p=payload(n),restored=parseICSToEvents(serializeICS(p.events));assert.equal(restored.length,n);for(let i=0;i<n;i++)for(const key of ['title','startDate','endDate','startTime','endTime','description','location','allDay','timeZone','recurrence','reminders'] as const)assert.deepEqual(restored[i][key],p.events[i][key]);}
 assert.throws(()=>parseICSToEvents('not a calendar'));
});
