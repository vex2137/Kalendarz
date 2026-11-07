// Production UI + IndexedDB writes; inference is a bounded fake native bridge.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4193','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4193')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
  const context=await browser.newContext({timezoneId:'Europe/Warsaw',serviceWorkers:'block',viewport:{width:412,height:915}});
  await context.addInitScript(()=>{
   localStorage.setItem('offline_calendar_events_v2','[]');window.__requests=[];let loaded=false;
   const status=()=>({backend:'cpu-native',available:true,loaded,gpuActive:false,mode:'auto',contextApplied:2048,contextRequested:2048});
   window.calendarNativeAI={status:async()=>status(),info:async()=>({installed:true}),folders:async()=>({models:[],folders:[],warnings:[]}),setMode:async()=>status(),prepare:async()=>{loaded=true;return status();},stop:async()=>{loaded=false;},complete:async(id,request)=>{window.__requests.push(request);return {text:request.messages.at(-1).content==='Continue'?'The story continues from its previous ending.':'First part of a longer story.',finish:request.messages.at(-1).content==='Continue'?'stop':'length',usage:{prompt_tokens:80,completion_tokens:10},timings:{},backend:{...status(),modelId:id}};}};
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__copyFail)throw Error('denied');window.__copied=text;}}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+01:00'));await page.goto('http://127.0.0.1:4193');
  const records=()=>page.evaluate(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events));
  const send=async q=>{await page.locator('#drawer-ai-assistant input').fill(q);await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#btn-stop-ai-generation')); };
  await page.locator('#btn-open-ai-assistant').click();
  const batch='Create three events: A 10 November at 10:00; B 11 November at 11:00; C 12 November at 12:00';
  await send(batch);const confirm=page.locator('[id^=btn-confirm-ai-event-]:visible').last();await confirm.waitFor();assert.equal((await records()).length,0);
  await page.getByTestId('cancel-ai-proposal').click();await confirm.waitFor({state:'hidden'});assert.equal((await records()).length,0);
  await send(batch);await confirm.waitFor();await confirm.click();await page.waitForFunction(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events.length===3));
  const id=(await records()).find(e=>e.title==='A').id;
  await send('Move A from 10 November to 10 November at 09:15');await confirm.waitFor();assert.equal((await records()).find(e=>e.id===id).startTime,'10:00');await confirm.click();
  await page.waitForFunction(async id=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events.find(e=>e.id===id).startTime==='09:15'),id);
  await send('Delete A on 10 November');await confirm.waitFor();assert.equal((await records()).length,3);await page.getByTestId('cancel-ai-proposal').click();assert.equal((await records()).length,3);
  await send('Delete A on 10 November');await confirm.waitFor();await confirm.click();await page.waitForFunction(async()=>(await import('/src/utils/calendarStore.ts')).loadCalendar().then(r=>r.events.length===2));
  // One stale member aborts the entire write transaction, including earlier puts.
  const atomic=await page.evaluate(async()=>{const s=await import('/src/utils/calendarStore.ts');const before=(await s.loadCalendar()).events;const changes=before.map(e=>({before:e,after:{...e,title:e.title+' changed'}}));await s.commitCalendar([{...before[1],title:'concurrent edit',updatedAt:Date.now()}]);try{await s.applyAssistantChanges(changes);return false;}catch{return (await s.loadCalendar()).events.find(e=>e.id===before[0].id).title===before[0].title;}});assert.equal(atomic,true);
  await page.locator('#btn-ai-settings').click();
  const generation=page.getByTestId('model-generation-settings').filter({visible:true});
  await generation.locator('input[type=checkbox]').uncheck();await generation.locator('input[type=number]').fill('1500');await generation.getByRole('button',{name:'Save response limit',exact:true}).click();
  await page.locator('#ai-tab-diagnostics').click();
  const copy=page.getByRole('button',{name:'Copy full diagnostics',exact:true});await copy.click();await page.getByText('Diagnostics copied.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__copied),await page.locator('#ai-diagnostics-report').innerText());
  await page.evaluate(()=>window.__copyFail=true);await copy.click();await page.getByRole('alert').filter({hasText:'Could not copy diagnostics'}).waitFor();
  await page.reload();await page.locator('#btn-open-ai-assistant').click();assert.equal((await records()).length,2);
  await send('Tell me a longer story about a forest');await page.getByText(/Response length limit reached/).last().waitFor();
  await send('Continue');await page.getByText('The story continues from its previous ending.',{exact:true}).waitFor();
  const requests=await page.evaluate(()=>window.__requests);assert.equal(requests[0].max_tokens,1500);assert.ok(requests[1].messages.some(m=>m.role==='assistant'&&m.content==='First part of a longer story.'));
  assert.deepEqual(errors,[]);console.log('PASS Beta4: real atomic calendar writes/rollback, no writes before confirmation/cancellation, stable IDs, restart persistence, manual generation budget, continuation and full JSON clipboard success/error. Native inference simulated.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
