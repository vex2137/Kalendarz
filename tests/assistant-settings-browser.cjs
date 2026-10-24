const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, writeFileSync } = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:4186';
(async () => {
  const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4186','--strictPort',...(process.env.ASSISTANT_TEST_WEB_DIR?['--outDir',process.env.ASSISTANT_TEST_WEB_DIR]:[])],{stdio:'ignore'});
  let browser; const results=[];
  try {
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    for(const width of [360,1280]) for(const language of ['en','pl','de','ru']) {
      console.log(`Settings: ${width}px / ${language}`);
      const context=await browser.newContext({viewport:{width,height:800},reducedMotion:'reduce',serviceWorkers:'block'});
      await context.addInitScript(language=>localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language})),language);
      const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.locator('#btn-open-ai-assistant').click();
      const input=page.locator('#drawer-ai-assistant input[type=text]');await input.waitFor();
      await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]').disabled);
      for(let i=0;i<5;i++){await input.fill('Hello');await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]').disabled);}
      await page.waitForTimeout(250);
      await input.fill('Unsent draft');await page.locator('#ai-chat-messages').evaluate(el=>el.scrollTop=25);
      const before=await page.locator('#ai-chat-messages').evaluate(el=>el.scrollTop);
      await page.locator('#btn-ai-settings').click();
      assert.equal(await page.getByRole('dialog').count(),1);
      await page.locator('#ai-tab-diagnostics').click();
      await page.locator('#ai-panel-diagnostics').evaluate(el=>el.scrollTop=200);
      const box=await page.locator('#ai-settings-panel').boundingBox();assert.ok(box.height<=800&&box.y>=0);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#ai-settings-panel').count(),0);
      assert.equal(await input.inputValue(),'Unsent draft');assert.equal(await page.locator('#ai-chat-messages').evaluate(el=>el.scrollTop),before);
      await page.waitForFunction(()=>document.activeElement?.id==='btn-ai-settings').catch(async error=>{throw new Error(`${width}/${language}: focus ${await page.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName)}: ${error.message}`);});
      await page.locator('#btn-ai-settings').click();
      assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('calendar-back',{cancelable:true}))),false);
      await page.locator('#ai-settings-panel').waitFor({state:'detached'});
      await page.locator('#btn-ai-chat-history').click();
      await page.evaluate(()=>window.dispatchEvent(new Event('calendar-back',{cancelable:true})));
      assert.equal(await input.inputValue(),'Unsent draft');
      await page.locator('#btn-ai-settings').click();await page.locator('#ai-tab-models').focus();await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#ai-tab-diagnostics').getAttribute('aria-selected'),'true');
      await page.locator('#ai-settings-panel header button').click();
      const inputBox=await input.boundingBox();assert.ok(inputBox.y+inputBox.height<=800);
      assert.deepEqual(errors,[]);results.push({width,language,passed:true});await context.close();
    }
    if(process.env.SETTINGS_BROWSER_REPORT)writeFileSync(process.env.SETTINGS_BROWSER_REPORT,JSON.stringify(results,null,2));
    console.log('AI settings preserve scroll/draft, focus, Esc/Back and tabs: 8 viewport/language combinations passed.');
  } finally {await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
