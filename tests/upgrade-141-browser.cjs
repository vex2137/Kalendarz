// Serve the official 1.4.0 Web artifact, then this build at the SAME origin.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
  assert.ok(process.env.CALENDAR_140_WEB_DIR,'Set CALENDAR_140_WEB_DIR to the extracted official 1.4.0 Web ZIP');
  let root=path.resolve(process.env.CALENDAR_140_WEB_DIR),browser;
  const oldBuild=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8'));assert.equal(oldBuild.version,'1.4.0');
  const server=http.createServer(async(request,response)=>{
    try{
      const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
      const stat=await fs.stat(file);if(!stat.isFile())throw Error('not a file');
      response.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream','Cache-Control':'no-store'});
      createReadStream(file).pipe(response);
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const context=await browser.newContext({serviceWorkers:'block',timezoneId:'Europe/Warsaw'});
    const fixture={id:'upgrade-event-141',title:'Upgrade recurrence fixture',startDate:'2026-11-05',endDate:'2026-11-05',startTime:'09:30',endTime:'10:15',allDay:false,color:'peacock',recurrence:'WEEKLY',reminders:[0,15,1440],createdAt:42,updatedAt:42};
    const colors={background:'#09090b',surface:'#141416',header:'#141416',subtle:'#1f1f23',hover:'#27272d',border:'#2c2c34',text:'#fafafa',muted:'#a1a1aa',accent:'#3b82f6',accentText:'#ffffff',button:'#2563eb',buttonHover:'#1d4ed8',buttonText:'#ffffff'};
    await context.addInitScript(({fixture,colors})=>{
      if(localStorage.getItem('upgrade_fixture_seeded'))return;
      localStorage.setItem('offline_calendar_events_v2',JSON.stringify([fixture]));
      localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language:'pl',theme:'custom:upgrade-fixture',customThemes:[{id:'custom:upgrade-fixture',name:'Upgrade fixture',colors}],defaultReminder:0,soundEnabled:false,ai:{enabled:true,model:'lfm2.5-350m-q4-k-m'}}));
      localStorage.setItem('calendar_active_ai_model_v1','lfm2.5-350m-q4-k-m');
      localStorage.setItem('calendar_ai_backend_mode_v1','cpu');localStorage.setItem('upgrade_fixture_seeded','true');
    },{fixture,colors});
    const page=await context.newPage();page.on('pageerror',error=>console.error('Upgrade renderer:',error.message));page.on('requestfailed',request=>console.error('Upgrade request:',request.url(),request.failure()?.errorText));
    await page.goto(base);await page.locator('#btn-open-ai-assistant').click();await page.locator('#drawer-ai-assistant').waitFor();
    // Wait for the old application to initialize its real history schema.
    await page.waitForFunction(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('calendar-ai-chats');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const ready=db.objectStoreNames.contains('messages');db.close();return ready;});
    await page.evaluate(async()=>{
      const open=async name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const db=await open('calendar-ai-chats'),tx=db.transaction(['chats','messages'],'readwrite');
      tx.objectStore('chats').put({id:'upgrade-chat',title:'Upgrade history fixture',autoTitle:false,createdAt:42,updatedAt:43,modelIds:['lfm2.5-350m-q4-k-m'],selectedModelId:'lfm2.5-350m-q4-k-m',nextSequence:2});
      tx.objectStore('messages').put({chatId:'upgrade-chat',id:'upgrade-message',role:'user',content:'Synthetic upgrade history',timestamp:42,sequence:1,modelId:'lfm2.5-350m-q4-k-m'});
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem('calendar_active_chat_v1','upgrade-chat');
      // This storage fixture tests byte preservation, not model inference.
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models',{create:true});
      const handle=await dir.getFileHandle('lfm2.5-350m-q4-k-m-upgrade-fixture.gguf',{create:true}),writer=await handle.createWritable();await writer.write(new Uint8Array([71,71,85,70,1,2,3,4]));await writer.close();
    });
    const snapshot=()=>page.evaluate(async()=>{
      const open=async name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const read=async(name,store)=>{const db=await open(name);try{return await new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}};
      const records=await read('offline-calendar','records'),chats=await read('calendar-ai-chats','chats'),messages=await read('calendar-ai-chats','messages');
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'),file=await (await dir.getFileHandle('lfm2.5-350m-q4-k-m-upgrade-fixture.gguf')).getFile();
      const settings=JSON.parse(localStorage.getItem('offline_calendar_settings_v2'));
      return {event:records.find(r=>r.id==='upgrade-event-141'),chat:chats.find(r=>r.id==='upgrade-chat'),messages:messages.filter(r=>r.chatId==='upgrade-chat'),settings:{language:settings.language,theme:settings.theme,customThemes:settings.customThemes,defaultReminder:settings.defaultReminder,soundEnabled:settings.soundEnabled,ai:settings.ai},model:localStorage.getItem('calendar_active_ai_model_v1'),backend:localStorage.getItem('calendar_ai_backend_mode_v1'),modelBytes:[...new Uint8Array(await file.arrayBuffer())]};
    });
    await page.reload();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();const before=await snapshot();assert.deepEqual(before.event.event,fixture);
    root=path.resolve(process.env.CALENDAR_141_WEB_DIR||'dist');const newBuild=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8'));assert.ok(['1.4.1','1.4.1 beta','1.4.1 beta 2'].includes(newBuild.version),`Unexpected upgrade target: ${newBuild.version}`);
    await page.reload();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();
    assert.deepEqual(await snapshot(),before,'The same browser/origin must retain events, history, settings, model selection and OPFS bytes');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'custom:upgrade-fixture');
    await page.reload();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();assert.deepEqual(await snapshot(),before);
    console.log('PASS official 1.4.0 → 1.4.1 same-origin upgrade and restart preserve recurring event, reminders, custom theme, language, settings, AI history, model identity and OPFS bytes');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
