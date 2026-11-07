// Production drawer and IndexedDB; no real GGUF or GPU is used in this test.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4194','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4194')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
  const context=await browser.newContext({timezoneId:'Europe/Warsaw',serviceWorkers:'block',viewport:{width:412,height:915}});
  await context.addInitScript(()=>{localStorage.setItem('offline_calendar_events_v2','[]');let loaded=false;
   const status=()=>({backend:'cpu-native',available:true,loaded,gpuActive:false,mode:'auto',contextApplied:2048,contextRequested:2048});
   window.__modelCalls=0;window.calendarNativeAI={status:async()=>status(),info:async()=>({installed:true}),folders:async()=>({models:[],folders:[],warnings:[]}),setMode:async()=>status(),prepare:async()=>{loaded=true;return status();},stop:async()=>{loaded=false;},complete:async()=>{window.__modelCalls++;throw Error('unexpected-model-call');}};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));await page.goto('http://127.0.0.1:4194');await page.locator('#btn-open-ai-assistant').click();
  const records=()=>page.evaluate(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events));
  const send=async text=>{await page.locator('#drawer-ai-assistant input').fill(text);await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#btn-stop-ai-generation'));};
  const confirm=page.locator('[id^=btn-confirm-ai-event-]:visible').last();
  const cases=await page.evaluate(async()=>(await import('/tests/fixtures/beta5-cases.ts')).batchCases);
  for(const [,request,count]of cases){
   await send(request);await confirm.waitFor();const card=confirm.locator('..');assert.equal(await card.locator('div.space-y-1').count(),count);
   const text=await card.innerText();for(let i=0;i<count;i++){assert.ok(text.includes('TEST '+String.fromCharCode(65+i)));assert.ok(text.includes(`2026-11-${13+i}`));assert.ok(text.includes(`${10+2*i}:00`));assert.ok(text.includes(`${11+2*i}:00`));}
   assert.equal((await records()).length,0);await page.getByTestId('cancel-ai-proposal').click();await confirm.waitFor({state:'hidden'});assert.equal((await records()).length,0);
  }
  // A failure after the first actual put must abort all newly created records.
  const rollback=await page.evaluate(async request=>{
   const store=await import('/src/utils/calendarStore.ts'),ai=await import('/src/utils/modelAssistant.ts'),prefs=await import('/src/utils/assistantPlanning.ts'),changes=await import('/src/utils/assistantChanges.ts');
   const response=await ai.runModelAssistant(request,[],'pl',new Date(2026,10,7,10),{},prefs.DEFAULT_PLANNING),plan=response.suggestedPlan;
   const put=IDBObjectStore.prototype.put;let count=0;
   IDBObjectStore.prototype.put=function(...args){if(this.name==='records'&&++count===2)throw new DOMException('Synthetic quota failure','QuotaExceededError');return put.apply(this,args);};
   let failed=false;try{await store.applyAssistantChanges(changes.changesForPlan(plan));}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
   return {failed,records:(await store.loadCalendar()).events.length};
  },cases[0][1]);assert.deepEqual(rollback,{failed:true,records:0});
  await send(cases[0][1]);await confirm.waitFor();await confirm.click();await page.waitForFunction(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events.length===3));
  assert.deepEqual((await records()).sort((a,b)=>a.title.localeCompare(b.title)).map(e=>[e.title,e.startDate,e.startTime,e.endTime]),[['TEST A','2026-11-13','10:00','11:00'],['TEST B','2026-11-14','12:00','13:00'],['TEST C','2026-11-15','14:00','15:00']]);
  await send(cases[0][1]);await confirm.waitFor();assert.match(await page.locator('#drawer-ai-assistant').innerText(),/konflikt|conflict/iu);await page.getByTestId('cancel-ai-proposal').click();
  await page.evaluate(async()=>{const s=await import('/src/utils/calendarStore.ts');await s.commitCalendar([{id:'stable-beta5',title:'TEST BETA 4',startDate:'2026-11-12',endDate:'2026-11-12',startTime:'08:00',endTime:'09:00',allDay:false,color:'banana',reminders:[15],recurrence:'NONE',createdAt:1,updatedAt:1}]);s.signalCalendarChange();});
  const edits=await page.evaluate(async()=>(await import('/tests/fixtures/beta5-cases.ts')).editCases);
  for(const [,request]of edits){await send(request);await confirm.waitFor();assert.equal((await records()).find(e=>e.id==='stable-beta5').startTime,'08:00');await page.getByTestId('cancel-ai-proposal').click();}
  await send(edits[1][1]);await confirm.waitFor();await confirm.click();await page.waitForFunction(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events.find(e=>e.id==='stable-beta5').startTime==='09:15'));
  await send('Delete TEST BETA 4 on 2026-11-12');await confirm.waitFor();const deletion=await confirm.locator('..').innerText();assert.equal((deletion.match(/09:15/g)||[]).length,1);assert.equal((deletion.match(/10:30/g)||[]).length,1);
  await page.getByTestId('cancel-ai-proposal').click();await page.reload();await page.locator('#btn-open-ai-assistant').click();assert.equal((await records()).length,4);assert.equal((await records()).find(e=>e.id==='stable-beta5').endTime,'10:30');
  assert.equal(await page.evaluate(()=>window.__modelCalls),0);assert.deepEqual(errors,[]);console.log('PASS Beta5: six reported PL/EN batches, eight edit variants, exact stored fields, cancel/confirm, create rollback after second put failure, conflicts, stable IDs/restart and single deletion time range. Inference is not exercised.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
