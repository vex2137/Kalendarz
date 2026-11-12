const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync } = require('node:fs');
(async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({...(executablePath ? {executablePath} : {}), args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addInitScript(() => {
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({security:{pinEnabled:true,pinCode:'1234'}}));
      window.androidBridge = {}; window.bioResult = 'cancel'; window.bioReady = false;
      window.bioCalls = 0; window.bioStatusCalls = 0; window.bioListeners = new Map();
      window.Capacitor = {
        PluginHeaders: [
          {name:'CalendarDevice',methods:['setLanguage','biometricStatus','authenticateBiometric','notificationStatus','openNotificationSettings','removeListener'].map(name => ({name,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'}])},
          {name:'LocalNotifications',methods:['checkPermissions','requestPermissions','getPending','cancel','schedule'].map(name => ({name,rtype:'promise'}))},
        ],
        nativePromise: async (_plugin,method,options) => {
          if (method === 'biometricStatus') { window.bioStatusCalls++; return {available:true,ready:window.bioReady}; }
          if (method === 'authenticateBiometric') {
            window.bioCalls++;
            if (window.bioResult === 'pending') return new Promise((resolve,reject) => { window.finishBiometric = success => success ? resolve({authenticated:true}) : reject(new Error('cancel')); });
            if (window.bioResult !== 'success') throw new Error('cancel');
            return {authenticated:true};
          }
          if (method === 'removeListener') { window.bioListeners.delete(options.callbackId); return {}; }
          if (method === 'notificationStatus') return {enabled:true,channel:'ready'};
          if (method === 'checkPermissions' || method === 'requestPermissions') return {display:'granted'};
          if (method === 'getPending') return {notifications:[]};
          return {};
        },
        nativeCallback: (_plugin,method,options,callback) => {
          const id = String(window.bioListeners.size + 1);
          if (method === 'addListener') window.bioListeners.set(id,{event:options.eventName,callback});
          return Promise.resolve(id);
        },
      };
      window.biometricResume = () => {
        window.bioReady = true;
        for (const listener of window.bioListeners.values()) if (listener.event === 'biometricStateChanged') listener.callback({});
        window.dispatchEvent(new Event('focus'));
      };
    });
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4179');
    await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.pinHash);
    for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
    await page.locator('#btn-open-settings').click();await require('./settings-navigation.cjs')(page,'security');
    await page.getByLabel('Current PIN', {exact:true}).fill('1234');
    const toggle = page.getByLabel('Biometric unlock');
    await toggle.waitFor({state:'visible'});
    await page.evaluate(() => {window.bioReady = true;});
    await toggle.click();
    await page.getByText('Biometrics are unavailable or authentication was cancelled.', {exact:true}).waitFor();
    assert.equal(await toggle.isChecked(), false);
    await page.evaluate(() => {window.bioResult = 'success';});
    await toggle.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).security.biometricEnabled === true);
    await page.evaluate(() => {window.bioResult = 'cancel';});
    const enrollmentCalls = await page.evaluate(() => window.bioCalls);
    await page.getByRole('button', {name:'Lock now',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => window.bioCalls), enrollmentCalls + 1, 'lock entry automatically authenticates once');
    assert.equal(await page.getByRole('heading', {name:'Calendar Locked'}).count(), 1);
    await page.evaluate(() => {window.biometricResume();document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.bioCalls), enrollmentCalls + 1, 'cancellation must not cause a resume/focus loop');
    await page.evaluate(() => {window.bioResult = 'success';});
    await page.getByRole('button', {name:'Use biometrics'}).click();
    await page.locator('#btn-open-settings').waitFor();

    // Cold startup waits for native Activity readiness, then auto-prompts exactly once.
    await page.reload();
    await page.getByRole('button', {name:'Use biometrics'}).waitFor();
    await page.waitForFunction(() => window.bioStatusCalls > 0);
    assert.equal(await page.evaluate(() => window.bioCalls), 0);
    await page.evaluate(() => {window.bioResult = 'pending';window.biometricResume();});
    await page.waitForFunction(() => window.bioCalls === 1);
    await page.evaluate(() => {window.biometricResume();window.biometricResume();});
    assert.equal(await page.getByRole('button', {name:'Use biometrics'}).isDisabled(), true);
    assert.equal(await page.evaluate(() => window.bioCalls), 1, 'only one system prompt can be in flight');
    await page.evaluate(() => window.finishBiometric(false));
    await page.getByRole('alert').waitFor();
    await page.evaluate(() => window.biometricResume());
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.bioCalls), 1);
    // Existing credential fallback remains usable after cancellation.
    for (const digit of '1234') await page.getByRole('button', {name:digit,exact:true}).click();
    await page.locator('#btn-open-settings').waitFor();

    // A hidden WebView cannot launch a prompt; visibility return may make the first attempt.
    await page.reload();
    await page.getByRole('button', {name:'Use biometrics'}).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      window.biometricResume();
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.bioCalls), 0);
    await page.evaluate(() => {
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
      window.bioResult = 'success'; document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.locator('#btn-open-settings').waitFor();
    assert.equal(await page.evaluate(() => window.bioCalls), 1);
    console.log('PASS: native-bridge simulation covers enrollment, automatic unlock, readiness/foreground gating, cancellation without loops, concurrency, manual retry and PIN fallback');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
