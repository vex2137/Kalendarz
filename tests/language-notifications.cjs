const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync } = require('node:fs');
const base = process.env.CALENDAR_TEST_URL || 'http://127.0.0.1:4176';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.notificationTestPermission = 'default';
      class TestNotification {
        static get permission() { return window.notificationTestPermission; }
        static async requestPermission() { window.notificationTestPermission = 'granted'; return 'granted'; }
      }
      Object.defineProperty(window, 'Notification', { configurable: true, value: TestNotification });
      if (!localStorage.getItem('offline_calendar_events_v2')) localStorage.setItem('offline_calendar_events_v2', '[]');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#btn-open-settings').click();
    const section = page.getByTestId('system-notifications');
    await section.getByText('Notification permission is required', { exact: true }).waitFor();
    await section.getByRole('button', { name: 'Enable system notifications', exact: true }).click();
    await section.getByText('System notifications enabled', { exact: true }).waitFor();
    assert.equal(await section.getByRole('button', { name: 'Enable system notifications', exact: true }).count(), 0);
    await page.evaluate(() => { window.notificationTestPermission = 'denied'; window.dispatchEvent(new Event('focus')); });
    await section.getByText('System notifications are blocked', { exact: true }).waitFor();
    await page.evaluate(() => { window.notificationTestPermission = 'granted'; window.dispatchEvent(new Event('focus')); });
    await section.getByText('System notifications enabled', { exact: true }).waitFor();
    for (const [language, button, flag, name] of [
      ['pl', 'Polski', '🇵🇱', 'Kalendarz'], ['ru', 'Русский', '🇷🇺', 'Календарь'],
      ['en', 'English', '🇬🇧', 'Calendar'], ['de', 'Deutsch', '🇩🇪', 'Kalender'],
    ]) {
      const select = page.getByRole('button', { name: button, exact: true });
      assert.ok((await select.textContent()).includes(flag));
      await select.click();
      await page.waitForFunction(title => document.title === title, name);
      assert.equal(await select.getAttribute('aria-pressed'), 'true');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow in ${language}`);
      }
      await page.keyboard.press('Escape');
      await page.reload();
      await page.locator('#btn-open-settings').waitFor();
      assert.equal(await page.title(), name);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      await page.locator('#btn-open-settings').click();
    }
    await page.getByRole('heading', { name: 'Kalendereinstellungen', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#btn-mobile-fab-create').click();
    await page.locator('#input-event-title').fill('Besprechung mit Anna');
    await page.locator('#btn-save-event-form').click();
    // The modal closes only after the asynchronous IndexedDB commit succeeds.
    await page.locator('#input-event-title').waitFor({ state: 'detached' });
    await page.reload();
    await page.getByRole('navigation', { name: 'Kalenderansichten', exact: true }).getByRole('button', { name: 'Terminübersicht', exact: true }).click();
    await page.getByText('Besprechung mit Anna', { exact: true }).waitFor();
    assert.equal(await page.title(), 'Kalender');
    assert.deepEqual(errors, []);
    await context.close();
    // Exercise the browser UI through Capacitor's real proxy, with controlled OS replies.
    const native = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await native.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      window.androidBridge = {};
      window.nativePermission = 'granted';
      window.nativeChannel = 'silent';
      window.nativeEnabled = true;
      window.Capacitor = {
        PluginHeaders: [
          { name: 'CalendarDevice', methods: ['setLanguage', 'notificationStatus', 'openNotificationSettings', 'removeListener'].map(name => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'LocalNotifications', methods: ['checkPermissions', 'requestPermissions', 'getPending', 'cancel', 'schedule'].map(name => ({ name, rtype: 'promise' })) },
        ],
        nativePromise: async (plugin, method, options) => {
          if (method === 'notificationStatus') return { enabled: window.nativeEnabled, channel: window.nativeChannel };
          if (method === 'openNotificationSettings') window.nativeSettingsOpened = true;
          if (method === 'setLanguage') window.nativeAppLanguage = options.language;
          if (method === 'requestPermissions') window.nativePermission = 'granted';
          if (method === 'checkPermissions' || method === 'requestPermissions') return { display: window.nativePermission };
          if (method === 'getPending') return { notifications: [] };
          return {};
        },
        nativeCallback: (plugin, method, options, callback) => {
          if (method === 'addListener') window.nativeResume = callback;
          return Promise.resolve('resume-listener');
        },
      };
    });
    const phone = await native.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(base);
    await phone.locator('#btn-open-settings').click();
    const nativeSection = phone.getByTestId('system-notifications');
    await nativeSection.getByText('The reminder category is silent in Android', { exact: true }).waitFor();
    await nativeSection.getByRole('button', { name: 'Open Android notification settings', exact: true }).click();
    assert.equal(await phone.evaluate(() => window.nativeSettingsOpened), true);
    await phone.evaluate(() => { window.nativeChannel = 'ready'; window.nativeResume({}); });
    await nativeSection.getByText('System notifications enabled', { exact: true }).waitFor();
    await phone.evaluate(() => { window.nativeEnabled = false; window.nativeResume({}); });
    await nativeSection.getByText('System notifications are blocked', { exact: true }).waitFor();
    await phone.getByRole('button', { name: 'Deutsch', exact: true }).click();
    await phone.waitForFunction(() => window.nativeAppLanguage === 'de' && document.title === 'Kalender');
    assert.deepEqual(errors, []);
    await native.close();
    console.log('PASS: PL/EN/RU/DE flags, app names, persistence, 320/390px layout, German event saving; browser and Android bridge notification states refresh after permission/channel changes; native name follows selection.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
