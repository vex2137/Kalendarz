const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:reduced ? 'reduce' : 'no-preference'});
      await context.addInitScript(() => {
        if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({security:{pinEnabled:true,pinCode:'1234'}}));
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4179');
      await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
      for (const digit of '0000') await page.getByRole('button', {name:digit,exact:true}).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('status', {name:'Unlocked'}).count(), 0);
      assert.equal(await page.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
      await page.waitForTimeout(700);
      for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
      if (!reduced) {
        await page.getByRole('status', {name:'Unlocked'}).waitFor();
        assert.equal(await page.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
      }
      await page.locator('#btn-open-settings').waitFor();
      await page.locator('#btn-open-settings').click();await require('./settings-navigation.cjs')(page,'animations');
      await page.getByLabel('Animation level').selectOption('off');
      assert.equal(await page.locator('html').getAttribute('data-motion'), 'off');
      await page.getByLabel('Animation level').selectOption('subtle');
      assert.equal(await page.locator('html').getAttribute('data-motion'), 'subtle');
      await page.getByLabel('Animation level').selectOption('full');
      await page.getByLabel(/Animation speed/).fill('150');
      await page.getByLabel('Confetti (full motion)').check();
      await page.getByLabel('PIN unlock animation').uncheck();
      await page.getByLabel('Screen and view transitions').uncheck();
      await page.getByLabel('Button feedback').uncheck();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).animations);
      assert.deepEqual(stored, {level:'full', speed:150, confetti:true, pinUnlock:false, transitions:false, buttons:false});
      await page.reload();
      for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
      await page.locator('#btn-open-settings').waitFor();
      await page.locator('#btn-open-settings').click();await require('./settings-navigation.cjs')(page,'animations');
      assert.equal(await page.getByLabel('Animation level').inputValue(), 'full');
      assert.equal(await page.getByLabel(/Animation speed/).inputValue(), '150');
      assert.equal(await page.getByLabel('PIN unlock animation').isChecked(), false);
      assert.equal(await page.getByLabel('Confetti (full motion)').isChecked(), true);
      assert.equal(await page.getByLabel('Screen and view transitions').isChecked(), false);
      assert.equal(await page.getByLabel('Button feedback').isChecked(), false);
      await context.close();
    }
    console.log('PASS: authorization precedes success, reduced motion and persisted effect controls');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
