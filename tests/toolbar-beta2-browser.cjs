const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const language of ['en','pl','de','ru']){
  const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(language=>localStorage.setItem('offline_calendar_settings_v2',JSON.stringify({language,theme:'scifi'})),language);
  const page=await context.newPage();await page.goto('http://127.0.0.1:4179');await page.locator('#btn-open-settings').waitFor();
  for(const width of [1920,1366,1024,768,390]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language}/${width}: overflow`);
   const buttons=page.locator('.calendar-tool-button');
   for(const button of await buttons.all()){const box=await button.boundingBox();assert.ok(box.height>=40);assert.ok(box.x>=0&&box.x+box.width<=width);}
   if(width>=640)for(const button of await page.locator('.calendar-view-button').all())assert.ok(await button.evaluate(el=>el.scrollWidth<=el.clientWidth),`${language}/${width}: view label clipped`);
   if(width>=1280){
    const boxes=await Promise.all(['.calendar-date-controls','.calendar-view-nav','.calendar-global-actions'].map(s=>page.locator(s).boundingBox()));
    for(let i=1;i<boxes.length;i++)assert.ok(boxes[i-1].x+boxes[i-1].width<=boxes[i].x+1,`${language}/${width}: controls overlap`);
    const used=boxes[2].x+boxes[2].width-boxes[0].x;assert.ok(used/width>=.8&&used/width<=.96);
    assert.equal(await page.locator('.calendar-tool-label').first().isVisible(),true);
   }else assert.equal(await page.locator('.calendar-tool-label').first().isVisible(),false);
   await page.locator(width<640?'nav.sm\\:hidden button':'#btn-view-week').first().click();
  }
  await page.setViewportSize({width:1366,height:900});
  for(const id of ['btn-open-search','btn-open-ai-assistant','btn-open-sync','btn-open-settings','btn-open-download']){await page.locator('#'+id).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}
  await context.close();
 }
 console.log('PASS: toolbar 1920/1366/1024/768/390, four languages, Sci-Fi tokens, click targets, labels, no overlap and working actions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
