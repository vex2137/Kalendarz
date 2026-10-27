const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:4192';
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4192', '--strictPort'], { env: { ...process.env, DISABLE_HMR: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', browser;
  server.stdout.on('data', data => output += data);
  server.stderr.on('data', data => output += data);
  try {
    for (let attempt = 0; ; attempt++) {
      if (await fetch(base).then(r => r.ok).catch(() => false)) break;
      if (attempt === 100) throw Error(output);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Australia/Lord_Howe', hasTouch: true, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'day' }));
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-04T03:45:00+11:00'));
    await page.goto(base);
    await page.locator('.timeline-hour[aria-label$=" 03:30"]').click();
    await page.waitForFunction(() => document.querySelector('#input-start-time')?.value === '03:30');
    assert.equal(await page.locator('#input-start-date').inputValue(), '2026-10-04');
    await page.keyboard.press('Escape');
    await page.locator('#modal-event-form').waitFor({ state: 'detached' });
    console.log('PASS Lord Howe 03:30 time slot opens the actual event form at 03:30');

    await page.locator('#btn-view-week').click();
    const key = () => page.getByTestId('calendar-navigation').getAttribute('data-date-key');
    const original = await key();
    await page.locator('.timeline-date').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('[data-testid="calendar-navigation"]').dataset.dateKey.startsWith('2026-10-11'));
    await page.locator('.timeline-hour').first().focus();
    await page.keyboard.press('a');
    await page.waitForFunction(value => document.querySelector('[data-testid="calendar-navigation"]').dataset.dateKey === value, original);
    console.log('PASS ArrowRight and A navigate periods with focus inside data-no-swipe week');

    await page.setViewportSize({ width: 390, height: 844 });
    const scroller = page.locator('.calendar-week-scroller');
    const before = await scroller.evaluate(node => node.scrollLeft);
    const cdp = await context.newCDPSession(page);
    const start = before > 0 ? 90 : 330, dx = before > 0 ? 240 : -240;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y: 330 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + dx * i / 6, y: 331 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(value => document.querySelector('.calendar-week-scroller').scrollLeft !== value, before);
    assert.equal(await key(), original);
    assert.equal(await page.getByRole('dialog').count(), 0);
    console.log('PASS week touch still pans internally without changing period or opening a dialog');

    await page.locator('#btn-mobile-fab-create').click();
    await page.locator('#input-event-title').fill('Draft');
    await page.locator('#input-event-title').press('ArrowRight');
    await page.locator('#input-event-title').press('a');
    assert.equal(await key(), original);
    assert.equal(await page.locator('#input-event-title').inputValue(), 'Drafta');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS text editing and dialog exclusions remain active; no browser errors');

    const spring = await browser.newContext({ viewport: { width: 900, height: 800 }, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
    await spring.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'day' }));
    });
    const springPage = await spring.newPage(); springPage.on('pageerror', error => errors.push(error.message));
    await springPage.clock.setFixedTime(new Date('2026-03-29T01:15:00Z'));
    await springPage.goto(base);
    await springPage.locator('.timeline-hour[aria-label$=" 03:00"]').click();
    await springPage.locator('#input-event-title').waitFor();
    assert.equal(await springPage.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false, 'clean forms do not block unload');
    await springPage.locator('#input-event-title').fill('Spring gap draft');
    await springPage.locator('#input-start-time').fill('02:30');
    await springPage.locator('#input-end-time').fill('04:00');
    await springPage.locator('#btn-save-event-form').click();
    await springPage.getByText('This time does not exist because the clock moves forward. Choose another time in the displayed time zone.', { exact: true }).waitFor();
    assert.match(await springPage.getByTestId('event-timezone').innerText(), /Europe\/Warsaw/);
    const promptPromise = springPage.waitForEvent('dialog');
    const reload = springPage.reload().catch(error => error);
    const prompt = await promptPromise;
    assert.equal(prompt.type(), 'beforeunload');
    await prompt.dismiss(); await reload;
    assert.equal(await springPage.locator('#input-event-title').inputValue(), 'Spring gap draft');
    await springPage.locator('#input-start-time').fill('03:30');
    await springPage.locator('#btn-save-event-form').click();
    await springPage.locator('#modal-event-form').waitFor({ state: 'detached' });
    const records = await springPage.evaluate(async () => (await (await import('/src/utils/calendarStore.ts')).loadCalendar()).events);
    assert.equal(records.length, 1); assert.equal(records[0].startTime, '03:30');
    assert.deepEqual(errors, []);
    await spring.close();
    console.log('PASS spring-gap input guard, visible timezone, real reload cancellation with draft retention and corrected save');
  } catch (error) { console.error(output.slice(-1500)); throw error; }
  finally { await browser?.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
