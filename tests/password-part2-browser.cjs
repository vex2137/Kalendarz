const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addInitScript(() => {
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({security:{pinEnabled:true,pinCode:'1234'}}));
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4179');
    await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
    for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
    await page.locator('#btn-open-settings').click();
    await page.getByLabel('Current PIN', {exact:true}).fill('1234');
    await page.getByLabel('New password', {exact:true}).fill('Secure password 123');
    await page.getByLabel('Confirm password', {exact:true}).fill('incorrect');
    await page.getByRole('button', {name:'Save password',exact:true}).click();
    await page.getByText('Password confirmation does not match.', {exact:true}).waitFor();
    await page.getByLabel('Confirm password', {exact:true}).fill('Secure password 123');
    await page.getByRole('button', {name:'Save password',exact:true}).click();
    await page.getByText('Password saved.', {exact:true}).waitFor();
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security);
    assert.equal(settings.authenticationMethod, 'password');
    assert.ok(settings.passwordHash && settings.passwordSalt && settings.pinHash);
    assert.ok(!JSON.stringify(settings).includes('Secure password 123'));
    await page.reload();
    const password = page.getByLabel('Password', {exact:true});
    await password.fill('wrong');
    await page.getByRole('button', {name:'Unlock',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
    await page.getByLabel('Show password').check();
    assert.equal(await password.getAttribute('type'), 'text');
    await password.fill('Secure password 123');
    await page.getByRole('button', {name:'Unlock',exact:true}).click();
    await page.locator('#btn-open-settings').waitFor();
    await page.locator('#btn-open-settings').click();
    await page.getByLabel('Current password', {exact:true}).fill('wrong');
    await page.getByLabel('PIN Code Lock', {exact:true}).focus();
    await page.getByLabel('PIN Code Lock', {exact:true}).press('Space');
    await page.getByText('Enter the correct current credential.', {exact:true}).waitFor();
    assert.equal(await page.getByLabel('PIN Code Lock', {exact:true}).isChecked(), true);
    console.log('PASS: migrate PIN to salted password, confirmation, wrong password, visibility and authenticated disable');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
