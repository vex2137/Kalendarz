const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {existsSync}=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4190','--strictPort'],{stdio:'ignore'});let browser;
 try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4190')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:393,height:851},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(120000);
  await page.goto('http://127.0.0.1:4190');await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  await page.getByRole('switch').click();assert.equal(await page.getByRole('switch').getAttribute('aria-checked'),'true');await page.locator('#ai-settings-panel header button').click();
  const input=page.locator('#drawer-ai-assistant input[type=text]');await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]')?.disabled);
  await input.fill('Why are calendars useful? Answer in one sentence.');await page.locator('#btn-send-ai-message').click();
  await page.locator('#btn-stop-ai-generation').waitFor();await page.locator('#btn-minimize-ai-drawer').click();await page.locator('#drawer-ai-assistant').waitFor({state:'detached'});
  // Use another calendar dialog while the same native request runs.
  await page.locator('#btn-open-settings').click();await page.keyboard.press('Escape');
  await page.locator('#btn-open-ai-assistant').click();await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]')?.disabled);
  const reply=await page.locator('#ai-chat-messages .rounded-tl-xs').last().innerText();assert.ok(reply.length>0);assert.doesNotMatch(reply,/Install a model|could not run|stopped/i);
  await page.locator('#btn-ai-settings').click();await page.locator('#ai-tab-diagnostics').click();const diagnostics=JSON.parse(await page.locator('#ai-diagnostics-report').textContent());
  assert.equal(await page.locator('#ai-chat-messages').count(),1);assert.equal(diagnostics.lastTurn.id,1);assert.equal(diagnostics.lastTurn.route,'model');assert.ok(diagnostics.lastModel.completionTokens>0);
  console.log(JSON.stringify({passed:true,minimizedNativeResponse:reply,model:diagnostics.lastModel}));
 }finally{await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
