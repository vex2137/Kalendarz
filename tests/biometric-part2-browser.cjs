const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addInitScript(() => {
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({security:{pinEnabled:true,pinCode:'1234'}}));
      window.androidBridge = {}; window.bioResult = 'cancel';
      window.Capacitor = {
        PluginHeaders: [
          {name:'CalendarDevice',methods:['setLanguage','biometricStatus','authenticateBiometric','notificationStatus','openNotificationSettings','removeListener'].map(name => ({name,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'}])},
          {name:'LocalNotifications',methods:['checkPermissions','requestPermissions','getPending','cancel','schedule'].map(name => ({name,rtype:'promise'}))},
        ],
        nativePromise: async (_plugin,method) => {
          if (method === 'biometricStatus') return {available:true};
          if (method === 'authenticateBiometric') { if (window.bioResult !== 'success') throw new Error('cancel'); return {authenticated:true}; }
          if (method === 'notificationStatus') return {enabled:true,channel:'ready'};
          if (method === 'checkPermissions' || method === 'requestPermissions') return {display:'granted'};
          if (method === 'getPending') return {notifications:[]};
          return {};
        },
        nativeCallback: () => Promise.resolve('listener'),
      };
    });
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4179');
    await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
    for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
    await page.locator('#btn-open-settings').click();
    await page.getByLabel('Current PIN', {exact:true}).fill('1234');
    const toggle = page.getByLabel('Biometric unlock');
    await toggle.waitFor({state:'visible'});
    await toggle.click();
    await page.getByText('Biometrics are unavailable or authentication was cancelled.', {exact:true}).waitFor();
    assert.equal(await toggle.isChecked(), false);
    await page.evaluate(() => {window.bioResult = 'success';});
    await toggle.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.biometricEnabled === true);
    await page.getByRole('button', {name:'Lock now',exact:true}).click();
    await page.evaluate(() => {window.bioResult = 'cancel';});
    await page.getByRole('button', {name:'Use biometrics'}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
    await page.evaluate(() => {window.bioResult = 'success';});
    await page.getByRole('button', {name:'Use biometrics'}).click();
    await page.locator('#btn-open-settings').waitFor();
    console.log('PASS: native-bridge simulation requires authentication for enrollment and unlock; cancellation preserves lock');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
