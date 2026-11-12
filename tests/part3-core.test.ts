import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShortcuts, shortcutContexts, shortcutConflicts, normalizedShortcuts, reservedShortcut, shortcutKey } from '../src/utils/shortcuts';
import { encodeUnprotectedSync, encodeSync, decodeSync, QRAssembler, syncPreview } from '../src/utils/sync';
import { event } from './fixtures';
import { gzipSync } from 'fflate';
import { applySyncPayload } from '../src/utils/syncImport';
import { DEFAULT_APP_SETTINGS } from '../src/utils/constants';
import { DEFAULT_THEME_COLORS } from '../src/utils/themes';
import type { AppSettings } from '../src/types';
test('13 actions/14 bindings, normalization, disabled actions, modifiers and conflicts',()=>{
 assert.ok(shortcutContexts('search').includes('assistant-history'));assert.ok(shortcutContexts('settings').includes('assistant-history'));assert.deepEqual(shortcutContexts('year'),['calendar']);
 const map=defaultShortcuts();assert.equal(Object.keys(map).length,13);assert.equal(Object.values(map).flat().length,14);assert.deepEqual(map.search,['q','/']);assert.deepEqual(normalizedShortcuts({...map,assistant:[]}).assistant,[]);
 assert.match(shortcutConflicts({...map,create:['a']})[0],/assistant.*create/);assert.deepEqual(normalizedShortcuts({...map,create:['a']}),map);
 assert.equal(shortcutKey({key:'K',ctrlKey:true,shiftKey:true,altKey:false,metaKey:false}),'Ctrl+Shift+k');
 assert.equal(shortcutKey({key:'/',ctrlKey:false,shiftKey:true,altKey:false,metaKey:false}),'/');
 for(const key of ['Alt+F4','Ctrl+w','Meta+q','Ctrl+Shift+i','Meta+Space'])assert.ok(reservedShortcut(key));
 assert.deepEqual(normalizedShortcuts({...map,create:['Ctrl+w']}),map);
});
test('new frames verify each chunk, preserve sessions, duplicate/missing progress and arbitrary scan order',async()=>{
 const payload={v:2 as const,app:'cal-offline' as const,events:Array.from({length:120},(_,i)=>event({id:String(i),title:`Żółć ${crypto.randomUUID()}`,description:crypto.randomUUID()})),deletions:[]};
 const encoded=await encodeUnprotectedSync(payload),other=await encodeUnprotectedSync(payload);assert.ok(encoded.frames.length>2);assert.notDeepEqual(encoded.frames,other.frames);
 const a=new QRAssembler(),last=encoded.frames.at(-1)!;
 const start=await a.add(last);assert.equal(start.received,1);assert.equal(start.missing.length,encoded.frames.length-1);assert.equal(start.code,undefined);
 assert.equal((await a.add(last)).duplicate,true);
 await assert.rejects(a.add(other.frames[0]),/different-export/);
 const bad=encoded.frames[0].slice(0,-1)+(encoded.frames[0].endsWith('A')?'B':'A');await assert.rejects(a.add(bad),/Damaged/);
 let code='';for(const frame of [...encoded.frames].reverse())code=(await a.add(frame)).code||code;
 assert.deepEqual(await decodeSync(code),payload);
 const view=syncPreview(payload,[payload.events[0],event({id:'different-id',title:payload.events[1].title})]);assert.equal(view.duplicates,1);assert.equal(view.events,120);
});
test('legacy single and multipart gzip/encrypted transport and v1 JSON remain readable',async()=>{
 const p={v:2 as const,app:'cal-offline' as const,events:[event({description:'All fields: ąęßЯ'})],deletions:[]};
 for(const protectedCode of [false,true]){
  const encoded=protectedCode?await encodeSync(p,'correct horse battery'):await encodeUnprotectedSync(p);
  const [version,id,data]=encoded.code.split(':');const a=new QRAssembler();let code='';const count=Math.ceil(data.length/300);
  for(let i=count-1;i>=0;i--)code=(await a.add(`${version}P:${id}:${i}:${count}:${data.slice(i*300,(i+1)*300)}`)).code||code;
  assert.deepEqual(await decodeSync(code,protectedCode?'correct horse battery':undefined),p);
 }
 const e=p.events[0];const legacy={v:1,app:'cal-offline',e:[{id:e.id,t:e.title,sd:e.startDate,ed:e.endDate,st:e.startTime,et:e.endTime,ad:e.allDay,c:e.color,d:e.description,r:e.reminders,rec:e.recurrence,u:e.updatedAt}]};
 assert.equal((await decodeSync(JSON.stringify(legacy))).events[0].description,e.description);
 const bomb=Buffer.from(gzipSync(new Uint8Array(10*1024*1024+1).fill(65))).toString('base64');await assert.rejects(decodeSync(`KAL2:${'0'.repeat(64)}:${bomb}`),/too large/);
});
test('sync import preflights preference writes and compensates a failed atomic calendar commit',async()=>{
 const payload={v:2 as const,app:'cal-offline' as const,events:[event()],deletions:[],theme:'ocean' as const};
 const previous=structuredClone(DEFAULT_APP_SETTINGS),saved:typeof previous[]=[];let commits=0;
 await assert.rejects(applySyncPayload(payload,previous,()=>{throw Error('quota');},async()=>{commits++;}),/quota/);assert.equal(commits,0);
 await assert.rejects(applySyncPayload(payload,previous,value=>saved.push(value),async()=>{throw Error('transaction aborted');}),/transaction aborted/);
 assert.equal(saved.length,2);assert.equal(saved[0].theme,'ocean');assert.deepEqual(saved[1],previous);
 const next=await applySyncPayload(payload,previous,()=>{},async value=>{assert.deepEqual(value.events,payload.events);commits++;});
 assert.equal(commits,1);assert.equal(next.theme,'ocean');assert.deepEqual(next.security,previous.security);assert.deepEqual(next.ai,previous.ai);assert.deepEqual(next.customThemes,previous.customThemes);
});
test('import failure compensation preserves concurrent credentials, preferences and custom themes',async()=>{
 const imported={id:'custom:incoming' as const,name:'Incoming',colors:{...DEFAULT_THEME_COLORS}},other={...imported,id:'custom:other' as const,name:'Other window'};
 const previous:AppSettings={...structuredClone(DEFAULT_APP_SETTINGS),customThemes:[]};let latest=previous;
 const payload={v:2 as const,app:'cal-offline' as const,events:[event()],deletions:[],theme:imported.id,customTheme:imported};
 await assert.rejects(applySyncPayload(payload,previous,value=>{latest=value as typeof previous;},async()=>{
  latest={...latest,language:'de',security:{...latest.security,pinEnabled:true,autoLockMinutes:2},customThemes:[...(latest.customThemes||[]),other]};throw Error('atomic transaction failed');
 },()=>latest),/atomic transaction failed/);
 assert.equal(latest.language,'de');assert.equal(latest.security.pinEnabled,true);assert.equal(latest.security.autoLockMinutes,2);assert.equal(latest.theme,previous.theme);assert.deepEqual(latest.customThemes,[other]);
 latest=previous;
 const revised={...imported,name:'Edited in other window'};
 await assert.rejects(applySyncPayload(payload,previous,value=>{latest=value;},async()=>{latest={...latest,customThemes:[revised]};throw Error('transaction failed');},()=>latest));
 assert.equal(latest.theme,imported.id);assert.deepEqual(latest.customThemes,[revised]);
 latest=previous;
 const successful=await applySyncPayload(payload,previous,value=>{latest=value;},async()=>{latest={...latest,language:'ru'};},()=>latest);
 assert.equal(successful.language,'ru');assert.equal(successful.theme,imported.id);
});
