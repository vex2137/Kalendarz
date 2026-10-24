package com.kalendarz.offline;

import static org.junit.Assert.assertEquals;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run seed on official 1.3.1, install -r 1.4.0, then verify; never uninstall between stages. */
@RunWith(AndroidJUnit4.class)
public class CalendarUpgradeTest extends CalendarSmokeTest {
    @Test
    public void seedOfficial131() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"document.querySelector('#btn-open-settings')");
            evaluate(scenario,"window.__upgradeSeed=false;(async()=>{const req=indexedDB.open('offline-calendar');const db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});const tx=db.transaction('records','readwrite');const now=Date.now();tx.objectStore('records').put({id:'upgrade-140-event',updatedAt:now,event:{id:'upgrade-140-event',title:'Preserve 1.3.1 event',startDate:'2026-10-25',endDate:'2026-10-25',startTime:'08:00',endTime:'16:00',allDay:false,color:'peacock',recurrence:'NONE',reminders:[15],createdAt:now,updatedAt:now}});await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=no});db.close();const raw=localStorage.getItem('offline_calendar_settings_v2');localStorage.setItem('upgrade-140-settings-backup',raw||'');const settings=JSON.parse(raw||'{}');settings.language='pl';settings.theme='custom:upgrade-140';settings.customThemes=[{id:'custom:upgrade-140',name:'Upgrade acceptance',colors:{background:'#09090b',surface:'#141416',header:'#141416',subtle:'#1f1f23',hover:'#27272d',border:'#2c2c34',text:'#fafafa',muted:'#a1a1aa',accent:'#10b981',accentText:'#ffffff',button:'#059669',buttonHover:'#047857',buttonText:'#ffffff'}}];localStorage.setItem('offline_calendar_settings_v2',JSON.stringify(settings));localStorage.setItem('upgrade-140-settings',JSON.stringify(settings));window.__upgradeSeed=true;})().catch(e=>window.__upgradeError=String(e))");
            until(scenario,"window.__upgradeSeed");
        }
    }
    @Test
    public void verifyUpgrade140() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"document.querySelector('#btn-open-settings')");
            assertEquals("true",evaluate(scenario,"localStorage.getItem('offline_calendar_settings_v2')===localStorage.getItem('upgrade-140-settings')"));
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-theme=\"custom:upgrade-140\"]')!==null"));
            evaluate(scenario,"window.__upgradeRecord=null;const req=indexedDB.open('offline-calendar');req.onsuccess=()=>{const db=req.result;const get=db.transaction('records').objectStore('records').get('upgrade-140-event');get.onsuccess=()=>{window.__upgradeRecord=get.result;db.close();}};");
            until(scenario,"window.__upgradeRecord");
            assertEquals("\"Preserve 1.3.1 event\"",evaluate(scenario,"window.__upgradeRecord.event.title"));
            assertEquals("\"08:00\"",evaluate(scenario,"window.__upgradeRecord.event.startTime"));
            assertEquals("\"16:00\"",evaluate(scenario,"window.__upgradeRecord.event.endTime"));
            // Restore defaults only in this disposable emulator before the independent smoke suite.
            evaluate(scenario,"const previous=localStorage.getItem('upgrade-140-settings-backup');if(previous)localStorage.setItem('offline_calendar_settings_v2',previous);else localStorage.removeItem('offline_calendar_settings_v2');");
        }
    }
}
