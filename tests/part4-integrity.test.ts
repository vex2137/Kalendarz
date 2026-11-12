import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDB } from 'idb';
import { loadCalendar,commitCalendar } from '../src/utils/calendarStore';
import { event,memoryStorage } from './fixtures';
Object.defineProperty(globalThis,'localStorage',{value:memoryStorage()});
async function reset(){localStorage.setItem('offline_calendar_events_v2','[]');await loadCalendar();const db=await openDB('offline-calendar',1);const tx=db.transaction(['records','meta'],'readwrite');await tx.objectStore('records').clear();await tx.objectStore('meta').clear();await tx.done;db.close();}
async function snapshot(){const db=await openDB('offline-calendar',1);try{return {records:await db.getAll('records'),migrated:await db.get('meta','migrated')};}finally{db.close();}}
async function inject(operation:()=>Promise<unknown>,asynchronous=false){const put=IDBObjectStore.prototype.put;let count=0;IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){if(this.name==='records'&&++count===2){if(asynchronous)this.transaction.abort();else throw new DOMException('Synthetic full disk','QuotaExceededError');}return put.apply(this,args);};try{await assert.rejects(operation);}finally{IDBObjectStore.prototype.put=put;}await new Promise(r=>setTimeout(r,10));}
test('interrupted legacy migration rolls back records and marker, retains the exact backup and retries',async()=>{
 await reset();const raw=JSON.stringify([event({id:'migration-a'}),event({id:'migration-b'})]);localStorage.setItem('offline_calendar_events_v2',raw);
 await inject(loadCalendar);assert.deepEqual(await snapshot(),{records:[],migrated:undefined});assert.equal(localStorage.getItem('offline_calendar_events_v2'),raw);
 assert.equal((await loadCalendar()).events.length,2);const before=await snapshot();await loadCalendar();assert.deepEqual(await snapshot(),before);
});
test('an import synchronous quota failure cannot partially commit valid earlier records',async()=>{
 await reset();await loadCalendar();await commitCalendar([event({id:'kept'})]);const before=await snapshot();
 await inject(()=>commitCalendar([event({id:'import-a'}),event({id:'import-b'})]));assert.deepEqual(await snapshot(),before);
 await commitCalendar([event({id:'import-a'}),event({id:'import-b'})]);assert.equal((await loadCalendar()).events.length,3);
});
test('an asynchronously aborted migration remains retryable without a false migrated marker',async()=>{
 await reset();localStorage.setItem('offline_calendar_events_v2',JSON.stringify([event({id:'async-a'}),event({id:'async-b'})]));await inject(loadCalendar,true);
 assert.deepEqual(await snapshot(),{records:[],migrated:undefined});assert.equal((await loadCalendar()).events.length,2);
});
test('corrupted legacy input is never a successful empty calendar and never replaces its backup',async()=>{
 await reset();const raw='[{"id":"truncated"';localStorage.setItem('offline_calendar_events_v2',raw);await assert.rejects(loadCalendar);assert.equal(localStorage.getItem('offline_calendar_events_v2'),raw);assert.deepEqual(await snapshot(),{records:[],migrated:undefined});
});
test('all-day multiday and recurring events retain IDs, exceptions and optional/unknown fields',async()=>{
 await reset();const values=[{...event({id:'multiday',startDate:'2026-11-08',endDate:'2026-11-11',allDay:true}),futureProperty:{preserve:'Żółć'}},event({id:'rrule',rrule:'FREQ=WEEKLY;COUNT=12',exdates:['2026-11-15'],timeZone:'Europe/Warsaw',description:'Opis\n第二行',location:'Łódź'})];localStorage.setItem('offline_calendar_events_v2',JSON.stringify(values));assert.deepEqual((await loadCalendar()).events,values);assert.deepEqual((await loadCalendar()).events,values);
});
