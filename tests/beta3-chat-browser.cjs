// Real UI/parser/history with a simulated inference boundary. No model-quality claim.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4209','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_MODEL_FREE:'true'}});let browser;
try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4209')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({timezoneId:'Europe/Warsaw',serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('offline_calendar_events_v2','[]');let loaded=false;const status=()=>({backend:'cpu-native',available:true,loaded,gpuActive:false,mode:'cpu',contextApplied:2048});window.reply='Forests contain many trees.';window.requests=[];window.calendarNativeAI={status:async()=>status(),info:async()=>({installed:true,verified:true}),folders:async()=>({folders:[],models:[],warnings:[]}),setMode:async()=>status(),prepare:async()=>{loaded=true;return status();},stop:async()=>{loaded=false;},complete:async(id,request)=>{window.requests.push(request);return{text:window.reply,finish:'stop',usage:{prompt_tokens:20,completion_tokens:10},timings:{},backend:status()};}};});
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-12-31T23:30:00+01:00'));await page.goto('http://127.0.0.1:4209');await page.locator('#btn-open-ai-assistant').click();
 const send=async text=>{await page.locator('#drawer-ai-assistant input').fill(text);await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#btn-stop-ai-generation'));};
 const confirm=page.locator('[id^=btn-confirm-ai-event-]:visible');
 await send('Utwórz wydarzenie Pending jutro od 15:00 do 16:00');await confirm.waitFor();const originalId=await confirm.getAttribute('id');
 await send('Tell me about forests');await page.getByText('Forests contain many trees.',{exact:true}).waitFor();assert.equal(await confirm.getAttribute('id'),originalId,'Ordinary chat must retain the pending proposal');
 assert.equal(await page.getByText('Model reply, not a save confirmation',{exact:true}).count(),0);
 const system=await page.evaluate(()=>window.requests.at(-1).messages[0].content);assert.match(system,/2026-12-31 23:30/);assert.match(system,/Europe\/Warsaw/);
 await page.evaluate(()=>window.reply='I saved the event.');await send('Can you tell me about trees?');await page.getByText(/No calendar changes were made by this reply/).waitFor();assert.equal(await confirm.getAttribute('id'),originalId);
 assert.equal(await page.evaluate(async()=>(await(await import('/src/utils/calendarStore.ts')).loadCalendar()).events.length),0);
 await confirm.click();await page.waitForFunction(async()=>(await(await import('/src/utils/calendarStore.ts')).loadCalendar()).events.some(e=>e.title==='Pending'));
 assert.equal(await page.evaluate(async()=>(await(await import('/src/utils/calendarStore.ts')).loadCalendar()).events.filter(e=>e.title==='Pending').length),1);
 console.log('PASS chat local clock, no repetitive footer, false-save guard, proposal retained across chat and exactly one confirmed write');
}finally{await browser?.close();vite.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
