package com.kalendarz.offline;

import static org.junit.Assert.assertEquals;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run seed on official 1.4.0, install -r 1.4.1, then verify; never uninstall between stages. */
@RunWith(AndroidJUnit4.class)
public class CalendarUpgradeTest extends CalendarSmokeTest {
    @Test
    public void seedOfficial140() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"document.querySelector('#btn-open-settings')");
            evaluate(scenario,"window.__upgradeSeed=false;(async()=>{const req=indexedDB.open('offline-calendar');const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});const tx=db.transaction('records','readwrite');const now=Date.now();tx.objectStore('records').put({id:'upgrade-141-event',updatedAt:now,event:{id:'upgrade-141-event',title:'Preserve 1.4.0 event',startDate:'2026-10-25',endDate:'2026-10-25',startTime:'08:00',endTime:'16:00',allDay:false,color:'peacock',recurrence:'NONE',reminders:[15],createdAt:now,updatedAt:now}});await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=no});db.close();const raw=localStorage.getItem('offline_calendar_settings_v2');localStorage.setItem('upgrade-141-settings-backup',raw||'');const settings=JSON.parse(raw||'{}');settings.language='pl';settings.theme='custom:upgrade-141';settings.customThemes=[{id:'custom:upgrade-141',name:'Upgrade acceptance',colors:{background:'#09090b',surface:'#141416',header:'#141416',subtle:'#1f1f23',hover:'#27272d',border:'#2c2c34',text:'#fafafa',muted:'#a1a1aa',accent:'#10b981',accentText:'#ffffff',button:'#059669',buttonHover:'#047857',buttonText:'#ffffff'}}];localStorage.setItem('offline_calendar_settings_v2',JSON.stringify(settings));localStorage.setItem('upgrade-141-settings',JSON.stringify(settings));localStorage.setItem('calendar_active_ai_model_v1','lfm2.5-350m-q4-k-m');const modelRequest=indexedDB.open('calendar-local-model',1);modelRequest.onupgradeneeded=()=>modelRequest.result.createObjectStore('models');const modelDB=await new Promise((ok,no)=>{modelRequest.onsuccess=()=>ok(modelRequest.result);modelRequest.onerror=()=>no(modelRequest.error)});const weights=await(await fetch('/models/LFM2.5-350M-Q4_K_M.gguf')).blob();if(weights.size!==229312224)throw Error('Previous bundled model not found');const mt=modelDB.transaction('models','readwrite');mt.objectStore('models').put(weights,'lfm2.5-350m-q4-k-m');await new Promise((ok,no)=>{mt.oncomplete=ok;mt.onerror=no});modelDB.close();const cr=indexedDB.open('calendar-ai-chats',1);cr.onupgradeneeded=()=>{const db=cr.result,c=db.createObjectStore('chats',{keyPath:'id'});c.createIndex('updated',['updatedAt','id']);const m=db.createObjectStore('messages',{keyPath:['chatId','id']});m.createIndex('order',['chatId','sequence','id']);m.createIndex('chat','chatId')};const chatDB=await new Promise((ok,no)=>{cr.onsuccess=()=>ok(cr.result);cr.onerror=()=>no(cr.error)});const ct=chatDB.transaction(['chats','messages'],'readwrite');ct.objectStore('chats').put({id:'upgrade-141-chat',title:'Preserve AI history',createdAt:now,updatedAt:now,modelIds:['lfm2.5-350m-q4-k-m'],selectedModelId:'lfm2.5-350m-q4-k-m',nextSequence:1});ct.objectStore('messages').put({chatId:'upgrade-141-chat',id:'upgrade-message',sequence:0,role:'user',content:'Zachowaj tę rozmowę',timestamp:now});await new Promise((ok,no)=>{ct.oncomplete=ok;ct.onerror=no});chatDB.close();window.__upgradeSeed=true;})().catch(e=>window.__upgradeError=String(e))");
            until(scenario,"window.__upgradeSeed");
        }
    }
    @Test
    public void verifyUpgrade141() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"document.querySelector('#btn-open-settings')");
            assertEquals("true",evaluate(scenario,"localStorage.getItem('offline_calendar_settings_v2')===localStorage.getItem('upgrade-141-settings')"));
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-theme=\"custom:upgrade-141\"]')!==null"));
            evaluate(scenario,"window.__upgradeRecord=null;const req=indexedDB.open('offline-calendar');req.onsuccess=()=>{const db=req.result;const get=db.transaction('records').objectStore('records').get('upgrade-141-event');get.onsuccess=()=>{window.__upgradeRecord=get.result;db.close();}};");
            until(scenario,"window.__upgradeRecord");
            assertEquals("\"Preserve 1.4.0 event\"",evaluate(scenario,"window.__upgradeRecord.event.title"));
            assertEquals("\"08:00\"",evaluate(scenario,"window.__upgradeRecord.event.startTime"));
            assertEquals("\"16:00\"",evaluate(scenario,"window.__upgradeRecord.event.endTime"));
            assertEquals("\"lfm2.5-350m-q4-k-m\"",evaluate(scenario,"localStorage.getItem('calendar_active_ai_model_v1')"));
            evaluate(scenario,"window.__upgradeAI=null;(async()=>{const open=name=>new Promise((ok,no)=>{const r=indexedDB.open(name);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const get=(db,store,key)=>new Promise((ok,no)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});const md=await open('calendar-local-model'),blob=await get(md,'models','lfm2.5-350m-q4-k-m');md.close();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');const cd=await open('calendar-ai-chats'),chat=await get(cd,'chats','upgrade-141-chat'),message=await get(cd,'messages',['upgrade-141-chat','upgrade-message']);cd.close();window.__upgradeAI={bytes:blob.size,hash,chat:chat.title,message:message.content};})().catch(e=>window.__upgradeAIError=String(e));");
            until(scenario,"window.__upgradeAI");
            assertEquals("229312224",evaluate(scenario,"window.__upgradeAI.bytes"));
            assertEquals("\"7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4\"",evaluate(scenario,"window.__upgradeAI.hash"));
            assertEquals("\"Preserve AI history\"",evaluate(scenario,"window.__upgradeAI.chat"));
            assertEquals("\"Zachowaj tę rozmowę\"",evaluate(scenario,"window.__upgradeAI.message"));
            evaluate(scenario,"localStorage.removeItem('calendar_active_ai_model_v1');");
            // Restore defaults only in this disposable emulator before the independent smoke suite.
            evaluate(scenario,"const previous=localStorage.getItem('upgrade-141-settings-backup');if(previous)localStorage.setItem('offline_calendar_settings_v2',previous);else localStorage.removeItem('offline_calendar_settings_v2');");
        }
    }
}
