// Serve the checksum-verified published 1.4.2 artifact, then Part 4 at the SAME origin.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
  assert.ok(process.env.CALENDAR_140_WEB_DIR,'Set CALENDAR_140_WEB_DIR to the extracted official 1.4.0 Web ZIP');
  let root=path.resolve(process.env.CALENDAR_140_WEB_DIR),browser;
  const oldBuild=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8'));assert.equal(oldBuild.version,process.env.CALENDAR_UPGRADE_SOURCE_VERSION||'1.4.2');
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
    const fixtures=[fixture,
      {...fixture,id:'all-day',title:'Cały dzień',allDay:true,startTime:undefined,endTime:undefined,recurrence:'NONE'},
      {...fixture,id:'multi-year',title:'Across year',startDate:'2026-12-31',endDate:'2027-01-02',startTime:'23:00',endTime:'01:30',recurrence:'NONE',description:'Żółć\nLine 2',location:'Łódź',futureField:{preserve:true}},
      {...fixture,id:'custom-rule',title:'Custom repeat',recurrence:'CUSTOM',customRecurrence:{interval:2,unit:'WEEK',daysOfWeek:[1,3],endType:'COUNT',count:12}},
      {...fixture,id:'rrule-exception',title:'RRULE',recurrence:'NONE',rrule:'FREQ=WEEKLY;COUNT=9',exdates:['2026-11-12'],timeZone:'Europe/Warsaw'},
      {...fixture,id:'completed',title:'Completed task',recurrence:'NONE',isCompletedTask:true,description:'Exact optional fields'}];
    const colors={background:'#09090b',surface:'#141416',header:'#141416',subtle:'#1f1f23',hover:'#27272d',border:'#2c2c34',text:'#fafafa',muted:'#a1a1aa',accent:'#3b82f6',accentText:'#ffffff',button:'#2563eb',buttonHover:'#1d4ed8',buttonText:'#ffffff'};
    await context.addInitScript(({fixtures,colors})=>{
      if(localStorage.getItem('upgrade_fixture_seeded'))return;
      localStorage.setItem('offline_calendar_events_v2',JSON.stringify(fixtures));
      localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language:'pl',theme:'custom:upgrade-fixture',customThemes:[{id:'custom:upgrade-fixture',name:'Upgrade fixture',colors}],defaultReminder:0,soundEnabled:false,security:{pinEnabled:true,pinCode:'2468'},ai:{enabled:true,model:'lfm2.5-350m-q4-k-m'}}));
      localStorage.setItem('calendar_active_ai_model_v1','lfm2.5-350m-q4-k-m');
      localStorage.setItem('calendar_ai_backend_mode_v1','cpu');localStorage.setItem('upgrade_fixture_seeded','true');
    },{fixtures,colors});
    const page=await context.newPage();page.on('pageerror',error=>console.error('Upgrade renderer:',error.message));page.on('requestfailed',request=>console.error('Upgrade request:',request.url(),request.failure()?.errorText));
    const unlock=async()=>{await page.getByRole('heading',{name:'Kalendarz zablokowany'}).waitFor();await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);for(const digit of '2468')await page.getByRole('button',{name:digit,exact:true}).click();await page.locator('#btn-open-ai-assistant').waitFor();};
    await page.goto(base);await unlock();await page.locator('#btn-open-ai-assistant').click();await page.locator('#drawer-ai-assistant').waitFor();
    // Wait for the old application to initialize its real history schema.
    await page.waitForFunction(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('calendar-ai-chats');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const ready=db.objectStoreNames.contains('messages');db.close();return ready;});
    // Schema creation precedes resolveActiveChat/rememberChat. Seed only after
    // that real initialization finishes, otherwise it can overwrite our active ID.
    await page.waitForFunction(()=>{const history=document.getElementById('btn-ai-chat-history');return history&&!history.disabled;});
    await page.evaluate(async()=>{
      const open=async name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const db=await open('calendar-ai-chats'),tx=db.transaction(['chats','messages'],'readwrite');
      tx.objectStore('chats').put({id:'upgrade-chat',title:'Upgrade history fixture',autoTitle:false,createdAt:42,updatedAt:43,modelIds:['lfm2.5-350m-q4-k-m'],selectedModelId:'lfm2.5-350m-q4-k-m',nextSequence:9});
      tx.objectStore('chats').put({id:'inactive-chat',title:'Inactive history',autoTitle:false,createdAt:40,updatedAt:41,modelIds:['lfm2.5-350m-q4-k-m'],nextSequence:1});
      tx.objectStore('messages').put({chatId:'upgrade-chat',id:'upgrade-message',role:'user',content:'Synthetic upgrade history',timestamp:42,sequence:1,modelId:'lfm2.5-350m-q4-k-m'});
      for(let i=2;i<=8;i++)tx.objectStore('messages').put({chatId:'upgrade-chat',id:'history-'+i,role:i%2?'user':'assistant',content:'Saved history Żółć '+i,timestamp:42+i,sequence:i,modelId:'lfm2.5-350m-q4-k-m'});
      await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem('calendar_active_chat_v1','upgrade-chat');
      // This storage fixture tests byte preservation, not model inference.
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models',{create:true});
      const handle=await dir.getFileHandle('lfm2.5-350m-q4-k-m-upgrade-fixture.gguf',{create:true}),writer=await handle.createWritable();await writer.write(Uint8Array.from({length:64},(_,i)=>i<4?[71,71,85,70][i]:i));await writer.close();
      const bytes=new Uint8Array(await (await handle.getFile()).arrayBuffer()),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      const descriptor={id:'imported-'+hash,sha256:hash,bytes:bytes.length,name:'Synthetic preservation fixture, not an inference model',architecture:'llama',maxContext:2048,url:'',imported:true,bundled:false,revision:'imported',format:'gguf',quantization:'Q4_K_M'};
      localStorage.setItem('calendar_imported_ai_models_v1',JSON.stringify([descriptor]));
      const models=await new Promise((resolve,reject)=>{const r=indexedDB.open('calendar-local-model',1);r.onupgradeneeded=()=>r.result.createObjectStore('models');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const modelTx=models.transaction('models','readwrite');modelTx.objectStore('models').put({opfsName:'lfm2.5-350m-q4-k-m-upgrade-fixture.gguf',bytes:bytes.length,sha256:hash},descriptor.id);await new Promise((resolve,reject)=>{modelTx.oncomplete=resolve;modelTx.onabort=()=>reject(modelTx.error);});models.close();

    });
    const snapshot=()=>page.evaluate(async()=>{
      const open=async name=>new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const read=async(name,store)=>{const db=await open(name);try{return await new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}};
      const records=await read('offline-calendar','records'),chats=await read('calendar-ai-chats','chats'),messages=await read('calendar-ai-chats','messages');
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models'),file=await (await dir.getFileHandle('lfm2.5-350m-q4-k-m-upgrade-fixture.gguf')).getFile();
      const settings=JSON.parse(localStorage.getItem('offline_calendar_settings_v2'));
      return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),chats:chats.sort((a,b)=>a.id.localeCompare(b.id)),messages:messages.sort((a,b)=>(a.chatId+':'+a.id).localeCompare(b.chatId+':'+b.id)),settings:{security:settings.security,language:settings.language,theme:settings.theme,customThemes:settings.customThemes,defaultReminder:settings.defaultReminder,soundEnabled:settings.soundEnabled,ai:settings.ai,defaultEventDuration:settings.defaultEventDuration,defaultView:settings.defaultView,defaultColor:settings.defaultColor,timeFormat24h:settings.timeFormat24h,compactView:settings.compactView,vibrationEnabled:settings.vibrationEnabled},model:localStorage.getItem('calendar_active_ai_model_v1'),backend:localStorage.getItem('calendar_ai_backend_mode_v1'),modelRegistry:localStorage.getItem('calendar_imported_ai_models_v1'),modelRecords:await read('calendar-local-model','models'),modelBytes:[...new Uint8Array(await file.arrayBuffer())]};
    });
    await page.reload();await unlock();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();const before=await snapshot();assert.deepEqual(before.records.map(r=>r.event).sort((a,b)=>a.id.localeCompare(b.id)),JSON.parse(JSON.stringify(fixtures)).sort((a,b)=>a.id.localeCompare(b.id)));assert.equal(before.messages.filter(m=>m.chatId==='upgrade-chat').length,8);assert.equal(before.chats.filter(c=>['upgrade-chat','inactive-chat'].includes(c.id)).length,2);
    root=path.resolve(process.env.CALENDAR_141_WEB_DIR||'dist');const newBuild=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8'));assert.ok(newBuild.version === '1.5.0',`Unexpected upgrade target: ${newBuild.version}`);
    await page.reload();await unlock();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();
    assert.deepEqual(await snapshot(),before,'The same browser/origin must retain events, history, settings, model selection and OPFS bytes');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'custom:upgrade-fixture');
    await page.reload();await unlock();await page.locator('#btn-open-ai-assistant').click();await page.getByText('Synthetic upgrade history',{exact:true}).waitFor();assert.deepEqual(await snapshot(),before);
    const digest=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const result={status:'PASS',source:oldBuild,target:newBuild,origin:base,sourceArchiveSha256:'2af8054115f0f688b700611718275a26a2d241e4dc54b13e8f378be50b5cc676',before:{events:before.records.length,chats:before.chats.length,messages:before.messages.length,models:before.modelRecords.length,customThemes:before.settings.customThemes.length,opfsBytes:before.modelBytes.length,snapshotSha256:digest(before)},after:{events:(await snapshot()).records.length,chats:(await snapshot()).chats.length,messages:(await snapshot()).messages.length,models:(await snapshot()).modelRecords.length,customThemes:(await snapshot()).settings.customThemes.length,opfsBytes:(await snapshot()).modelBytes.length,snapshotSha256:digest(await snapshot())},restartRepeated:true,syntheticModelBytesNotInference:true,nativeAndroidInstallTested:false};
    await fs.mkdir('manual-test-assets/part4',{recursive:true});await fs.writeFile('manual-test-assets/part4/upgrade-142.json',JSON.stringify(result,null,2));
    console.log('PASS published 1.4.2 upgrade/restart: '+JSON.stringify(result));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
