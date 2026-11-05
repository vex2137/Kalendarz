const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const themes = require('../src/utils/builtinThemes.json').themes;
const event = (id,date,extra={}) => ({id,title:id,startDate:date,endDate:date,startTime:'10:00',endTime:'11:00',allDay:false,color:'peacock',recurrence:'NONE',reminders:[],createdAt:1,updatedAt:1,...extra});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  for(const config of [{width:320,scale:1,reduced:false},{width:768,scale:1.5,reduced:true},{width:1280,scale:1,reduced:false}]) {
   const context=await browser.newContext({viewport:{width:config.width,height:900},serviceWorkers:'block',reducedMotion:config.reduced?'reduce':'no-preference'});
   const events=[event('Single','2026-11-16'),...Array.from({length:7},(_,i)=>event('Busy '+i,'2026-11-23',i===0?{allDay:true,endDate:'2026-11-25'}:{}))];
   await context.addInitScript(events=>{
    localStorage.setItem('offline_calendar_events_v2',JSON.stringify(events));
    localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language:'en',theme:'dark',animations:{level:'off'}}));
   },events);
   const page=await context.newPage(); await page.clock.setFixedTime(new Date('2026-11-05T12:00:00'));
   await page.goto('http://127.0.0.1:4179');await page.locator('[data-event-id="Single"]').first().waitFor();
   await page.evaluate(scale=>document.documentElement.style.fontSize=16*scale+'px',config.scale);
   const height=date=>page.locator('#calendar-cell-'+date).evaluate(node=>node.closest('.month-week').getBoundingClientRect().height);
   const empty=await height('2026-11-09'),single=await height('2026-11-16'),busy=await height('2026-11-23');
   assert.ok(empty<single && single<busy,JSON.stringify({config,empty,single,busy}));
   assert.ok(busy/config.scale<=146);
   const multi=page.locator('.month-segments [data-event-id="Busy 0"]');
   assert.equal(await multi.getAttribute('data-start'),'0');assert.equal(await multi.getAttribute('data-end'),'2');
   for(const theme of themes){
    await page.evaluate(id=>{const settings=JSON.parse(localStorage.getItem('offline_calendar_settings_v2'));settings.theme=id;localStorage.setItem('offline_calendar_settings_v2',JSON.stringify(settings));window.dispatchEvent(new StorageEvent('storage',{key:'offline_calendar_settings_v2'}));},theme.id);
    await page.waitForFunction(id=>document.documentElement.dataset.theme===id,theme.id);
    assert.equal(await height('2026-11-09'),empty);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
   await page.locator('#calendar-cell-2026-11-23 .month-overflow-'+(config.width<640?'mobile':'desktop')).click();
   await page.getByRole('button',{name:'Open day →',exact:true}).waitFor();
   const added=event('Added','2026-11-09');
   await page.evaluate(async e=>{const store=await import('/src/utils/calendarStore.ts');window.monthUndo=await store.applyAssistantChanges([{after:e}]);store.signalCalendarChange();},added);
   await page.locator('.month-segments [data-event-id="Added"]').waitFor();assert.equal(await height('2026-11-09'),single);
   await page.evaluate(async()=>{const store=await import('/src/utils/calendarStore.ts');await store.applyAssistantChanges(window.monthUndo);store.signalCalendarChange();});
   await page.locator('.month-segments [data-event-id="Added"]').waitFor({state:'detached'});assert.equal(await height('2026-11-09'),empty);
   await page.locator('#btn-nav-next').click();await page.waitForFunction(()=>document.querySelector('[data-testid="month-view"]').dataset.month==='2026-12');
   await context.close();
  }
  console.log('PASS: dynamic empty/single/busy weeks, all-day multi-day spans, add/remove, month navigation, eight palettes, responsive/text-scale/reduced-motion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
