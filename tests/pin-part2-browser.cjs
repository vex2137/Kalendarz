const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4179');
    await page.locator('#btn-open-settings').click();
    const pin = '1234567890123456';
    await page.getByLabel('PIN', {exact:true}).fill(pin);
    await page.getByLabel('Confirm new PIN', {exact:true}).fill('1234');
    await page.getByRole('button', {name:'Save PIN',exact:true}).click();
    await page.getByText('PIN confirmation does not match.', {exact:true}).waitFor();
    await page.getByLabel('Confirm new PIN', {exact:true}).fill(pin);
    await page.getByRole('button', {name:'Save PIN',exact:true}).click();
    await page.getByText('PIN successfully updated.', {exact:true}).waitFor();
    await page.getByLabel('PIN Code Lock', {exact:true}).focus();
    await page.getByLabel('PIN Code Lock', {exact:true}).press('Space');
    await page.getByRole('button', {name:'Lock now',exact:true}).click();
    await page.getByRole('heading', {name:'Calendar Locked'}).waitFor();
    await page.reload();
    for (const digit of pin) await page.getByRole('button', {name:digit,exact:true}).click();
    await page.locator('#btn-open-settings').waitFor();
    await page.locator('#btn-open-settings').click();
    await page.getByLabel('Current PIN', {exact:true}).fill('0000');
    await page.getByLabel('PIN', {exact:true}).fill('9876');
    await page.getByLabel('Confirm new PIN', {exact:true}).fill('9876');
    await page.getByRole('button', {name:'Save PIN',exact:true}).click();
    await page.getByText('Current credential is incorrect.', {exact:true}).waitFor();
    await page.getByLabel('Current PIN', {exact:true}).fill(pin);
    await page.getByRole('button', {name:'Save PIN',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinLength === 4);
    await page.getByLabel('Current PIN', {exact:true}).fill('0000');
    await page.getByLabel('PIN Code Lock', {exact:true}).focus();
    await page.getByLabel('PIN Code Lock', {exact:true}).press('Space');
    await page.getByText('Enter the correct current credential.', {exact:true}).waitFor();
    assert.equal(await page.getByLabel('PIN Code Lock', {exact:true}).isChecked(), true);
    await page.getByLabel('Current PIN', {exact:true}).fill('9876');
    await page.getByLabel('PIN Code Lock', {exact:true}).focus();
    await page.getByLabel('PIN Code Lock', {exact:true}).press('Space');
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinEnabled);
    console.log('PASS: confirmation, 16-digit PIN, reload unlock, authenticated change and disabling');
    await context.close();
    const legacy = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await legacy.addInitScript(() => {
      if (!localStorage.getItem('offline_calendar_settings_v2'))
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({security:{pinEnabled:true,pinCode:'1234'}}));
    });
    const oldPage = await legacy.newPage();
    await oldPage.goto('http://127.0.0.1:4179');
    await oldPage.getByRole('heading', {name:'Calendar Locked'}).waitFor();
    await oldPage.waitForFunction(() => !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
    for (const digit of '1234') await oldPage.getByRole('button', {name:digit,exact:true}).click();
    await oldPage.locator('#btn-open-settings').waitFor();
    await oldPage.reload();
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const digit of '0000') await oldPage.getByRole('button', {name:digit,exact:true}).click();
      await oldPage.waitForTimeout(700);
    }
    assert.ok(await oldPage.evaluate(() => Number(localStorage.getItem('pin-blocked-until')) > Date.now()));
    await oldPage.reload();
    for (const digit of '1234') await oldPage.getByRole('button', {name:digit,exact:true}).click();
    assert.equal(await oldPage.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
    console.log('PASS: legacy PIN migration and rate limit persist across reload');
    await legacy.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
