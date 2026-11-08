const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>{if(!localStorage.getItem('offline_calendar_settings_v2'))localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language:'en',security:{pinEnabled:true,pinCode:'1234'},animations:{level:'full',speed:50,transitions:true}}));});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4179');
 await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
 for(const digit of '1234')await page.getByRole('button',{name:digit,exact:true}).click();
 await page.locator('#btn-open-settings').click();await require('./settings-navigation.cjs')(page,'security');await page.getByRole('dialog').waitFor();
 await page.waitForTimeout(400);await page.keyboard.press('Escape');
 const durations=await page.getByRole('dialog').evaluate(el=>el.getAnimations().map(a=>a.effect.getTiming().duration));
 assert.ok(durations.includes(320));await page.getByRole('dialog').waitFor({state:'detached'});
 await page.locator('#btn-open-settings').click();await require('./settings-navigation.cjs')(page,'security');await page.getByRole('button',{name:'Lock now',exact:true}).click();
 await page.getByRole('heading',{name:'Calendar Locked'}).waitFor();await page.waitForTimeout(500);
 assert.equal(await page.getByRole('heading',{name:'Calendar Locked'}).count(),1);assert.equal(await page.getByRole('dialog').count(),0);
 await context.close();console.log('PASS: dialog exit honors speed and interrupted exit cannot dismiss lock');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
