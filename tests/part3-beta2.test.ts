import test from 'node:test';
import assert from 'node:assert/strict';
import { guardCalendarWriteClaim } from '../src/utils/calendarWriteClaim';
import { compareReleaseVersions,publicRelease } from '../src/utils/releaseVersion';
import { runModelAssistant } from '../src/utils/modelAssistant';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
const values=new Map();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)},configurable:true});
test('uncommitted generated write claims are not calendar confirmations; literal null and ordinary prose survive',()=>{
 for(const text of ['Utworzono 500 wydarzeń.','Stworzono 500 wydarzeń.','Utworzyłem 500 wydarzeń.','Dodałam 3 wydarzenia.','I created 500 events.','500 events have been created.','Events were saved.'])assert.match(guardCalendarWriteClaim(text,'en'),/No calendar changes/);
 for(const text of ['null is a valid JSON value.','No changes were saved.','No events were created.','Nie utworzono wydarzeń.','How can I create 500 events?','Mogę przygotować propozycję wydarzenia.'])assert.equal(guardCalendarWriteClaim(text,'pl'),text);
});
test('unsupported bulk quantity does not infer, propose or mutate events',async()=>{
 for(const [request,lang] of [['Utwórz 500 wydarzeń','pl'],['Create 500 events','en']] as const){const events:any[]=[];const answer=await runModelAssistant(request,events,lang,new Date(2026,10,8,10),{},DEFAULT_PLANNING,{onText:()=>assert.fail('Must not start inference')});assert.equal(answer.route,'rules');assert.equal(answer.suggestedPlan,undefined);assert.match(answer.text,/20/);assert.deepEqual(events,[]);}
});
test('all three reported clock ranges produce an uncommitted single proposal with the same local date',async()=>{
 for(const range of ['od 16 do 17','16–17','16:00–17:00']){const events:any[]=[];const answer=await runModelAssistant(`Utwórz wydarzenie Test jutro ${range}`,events,'pl',new Date(2026,10,8,10),{},DEFAULT_PLANNING);const proposal=answer.suggestedPlan;assert.equal(proposal?.kind,'create');assert.deepEqual(proposal?.events.map(e=>[e.title,e.startDate,e.startTime,e.endTime]),[['Test','2026-11-09','16:00','17:00']]);assert.deepEqual(events,[]);}
});
test('numeric semver handles older public stable, beta ordering, parts and SemVer build identity',()=>{
 for(const [a,b,order]of [['1.4.2','1.5.0-part3-beta.2',-1],['1.5.0','1.5.0-part3-beta.2',1],['1.5.0-part3-beta10','1.5.0-part3-beta.2',1],['1.5.0-part3-beta1','1.5.0-part2-beta99',1],['1.10.0','1.9.0',1],['1.5.0+10521','1.5.0+10520',0]] as const)assert.equal(compareReleaseVersions(a,b),order);
 assert.equal(compareReleaseVersions('invalid','1.5.0'),undefined);
 const release={draft:false,prerelease:false,tag_name:'v1.4.2',html_url:'https://github.com/vex2137/Kalendarz/releases/tag/v1.4.2',body:'Verified notes'};
 assert.equal(publicRelease(release,'1.5.0-part3-beta.2').available,false);
 assert.throws(()=>publicRelease({...release,html_url:'javascript:alert(1)'},'1.5.0'));
 assert.throws(()=>publicRelease({...release,prerelease:true},'1.5.0'));
});
