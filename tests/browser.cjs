const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:4174';
const fixture = (patch = {}) => ({
  id: 'existing',
  title: 'Existing event',
  startDate: '2026-10-18',
  endDate: '2026-10-18',
  startTime: '10:00',
  endTime: '11:00',
  allDay: false,
  color: 'peacock',
  recurrence: 'NONE',
  reminders: [],
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});
const records = (page) =>
  page.evaluate(async () => {
    const request = indexedDB.open('offline-calendar');
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const r = database
          .transaction('records')
          .objectStore('records')
          .getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      database.close();
    }
  });
async function until(fn) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Condition timed out');
}
(async () => {
  const server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4174',
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  let browser;
  try {
    await until(async () => {
      try {
        return (await fetch(base)).ok;
      } catch {
        return false;
      }
    });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_EXECUTABLE
        ? { executablePath: process.env.BROWSER_EXECUTABLE }
        : existsSync('/usr/bin/chromium')
          ? { executablePath: '/usr/bin/chromium' }
          : {}),
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'Europe/Warsaw',
    });
    await context.addInitScript((event) => {
      if (!localStorage.getItem('offline_calendar_events_v2')) {
        localStorage.setItem(
          'offline_calendar_events_v2',
          JSON.stringify([event]),
        );
        localStorage.setItem(
          'offline_calendar_settings_v2',
          JSON.stringify({ defaultReminder: 0, language: 'pl' }),
        );
      }
    }, fixture());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('Browser console:', m.text());
    });
    await page.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));
    await page.goto(base);
    await page.locator('#btn-create-event-top').waitFor();
    await page.locator('#btn-create-event-top').click();
    await until(
      async () =>
        (await page.locator('#input-start-date').inputValue()) === '2026-10-18',
    );
    await page.locator('#input-event-title').fill('Created event');
    await page.locator('#input-end-time').fill('09:00');
    await page.locator('#btn-save-event-form').click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'End must follow start' })
      .waitFor();
    await page.locator('#input-end-time').fill('11:00');
    await page.locator('#btn-save-event-form').click();
    await page.locator('#modal-event-form').waitFor({ state: 'detached' });
    let data = await records(page);
    assert.equal(data.filter((r) => r.event).length, 2);
    assert.deepEqual(
      data.find((r) => r.event?.title === 'Created event').event.reminders,
      [0],
    );
    await page.reload();
    await page.getByText('Created event', { exact: true }).waitFor();
    await page.getByText('Created event', { exact: true }).click();
    await page.locator('#input-event-title').fill('Edited event');
    await page.locator('#btn-save-event-form').click();
    await page.getByText('Edited event', { exact: true }).waitFor();
    console.log(
      'PASS create/edit/persist, local default date, validation and zero-minute reminder',
    );
    await page.locator('#btn-open-settings').click();
    await page.locator('#modal-settings input[type=file]').setInputFiles({
      name: 'calendar.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(
        'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:imported\r\nSUMMARY:Imported event\r\nDTSTART:20261018T140000\r\nDTEND:20261018T150000\r\nEND:VEVENT\r\nEND:VCALENDAR',
      ),
    });
    await until(async () =>
      (await records(page)).some((r) => r.id === 'imported'),
    );
    assert.ok(
      (await records(page)).some((r) => r.event?.title === 'Existing event'),
    );
    await page.getByRole('button', { name: /Dodaj polskie święta/ }).click();
    await until(async () =>
      (await records(page)).some((r) => r.id.startsWith('pl-holiday-')),
    );
    assert.ok(
      (await records(page)).some((r) => r.event?.title === 'Existing event'),
    );
    await page.locator('#btn-close-settings-modal').click();
    await page.locator('#btn-open-search').click();
    await page
      .getByRole('textbox', { name: 'Szukaj', exact: true })
      .fill('Imported');
    await page
      .locator('#modal-search')
      .getByRole('button', { name: /Imported event/ })
      .waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#modal-search').waitFor({ state: 'detached' });
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'btn-open-search',
    );
    console.log(
      'PASS non-destructive imports/holidays, virtual search, Escape and focus restoration',
    );
    for (const view of ['year', 'week', 'day', 'agenda', 'month']) {
      await page.locator('#btn-view-' + view).click();
      assert.ok((await page.locator('main').innerText()).length > 0);
    }
    await page.locator('#btn-open-settings').click();
    await page.getByRole('textbox', { name: 'PIN', exact: true }).fill('1234');
    await page.getByRole('button', { name: 'Zapisz PIN' }).click();
    await until(() =>
      page.evaluate(
        () =>
          !!JSON.parse(localStorage.getItem('offline_calendar_settings_v2'))
            .security?.pinHash,
      ),
    );
    await page
      .getByRole('checkbox', { name: 'Blokada kodem PIN', exact: true })
      .focus();
    await page
      .getByRole('checkbox', { name: 'Blokada kodem PIN', exact: true })
      .press('Space');
    await page.getByRole('button', { name: 'Zablokuj teraz' }).click();
    await page
      .getByRole('heading', { name: 'Kalendarz zablokowany' })
      .waitFor();
    await page.reload();
    await page
      .getByRole('heading', { name: 'Kalendarz zablokowany' })
      .waitFor();
    for (const digit of ['1', '2', '3', '4'])
      await page.getByRole('button', { name: digit, exact: true }).click();
    await page.locator('#btn-create-event-top').waitFor();
    const security = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('offline_calendar_settings_v2'))
          .security,
    );
    assert.equal(security.pinCode, '');
    assert.ok(security.pinHash && security.pinSalt);
    console.log('PASS PIN hashing, explicit lock and lock after reload');
    await page.locator('#btn-open-sync').click();
    const generateQR = async () => {
      await page.getByLabel('Hasło synchronizacji', { exact: true }).fill('Regression QR password 123');
      await page.getByRole('button', { name: 'Generuj szyfrowany kod', exact: true }).click();
      await page.getByRole('img', { name: 'Kod synchronizacji' }).waitFor();
    };
    await generateQR();
    await page.getByRole('checkbox', { name: 'Dołącz polskie święta' }).check();
    await generateQR();
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await context.close();
    const shared = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
    });
    await shared.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'pl' }));
    });
    const a = await shared.newPage(),
      b = await shared.newPage();
    await Promise.all([a.goto(base), b.goto(base)]);
    async function add(page, title) {
      await page.locator('#btn-create-event-top').click();
      await page.locator('#input-event-title').fill(title);
      await page.locator('#btn-save-event-form').click();
      await page.locator('#modal-event-form').waitFor({ state: 'detached' });
    }
    await Promise.all([add(a, 'Tab A event'), add(b, 'Tab B event')]);
    await a.getByText('Tab B event', { exact: true }).waitFor();
    await b.getByText('Tab A event', { exact: true }).waitFor();
    const old = (await records(a)).find(
      (r) => r.event?.title === 'Tab A event',
    ).event;
    await a.getByText('Tab A event', { exact: true }).click();
    await a.locator('#btn-delete-event').click();
    await a.locator('#btn-confirm-delete-yes').click();
    await a.locator('#modal-event-form').waitFor({ state: 'detached' });
    await b
      .getByText('Tab A event', { exact: true })
      .waitFor({ state: 'detached' });
    await a.locator('#btn-open-sync').click();
    await a.getByRole('button', { name: 'Plik', exact: true }).click();
    await a.locator('input[type=file]').setInputFiles({
      name: 'old-sync.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          v: 2,
          app: 'cal-offline',
          events: [old],
          deletions: [],
        }),
      ),
    });
    await a.getByRole('button', { name: 'Scal nieszyfrowane dane', exact: true }).click();
    await a
      .getByRole('status')
      .filter({ hasText: 'Zapisano i scalono dane.' })
      .waitFor();
    assert.equal(
      (await records(a)).find((r) => r.id === old.id).event,
      undefined,
    );
    await a.keyboard.press('Escape');
    await a.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      window.restoreWrite = () => (IDBObjectStore.prototype.put = original);
      IDBObjectStore.prototype.put = function (value, ...args) {
        if (value.event?.title === 'Failed write')
          throw new DOMException('Test disk full', 'QuotaExceededError');
        return original.call(this, value, ...args);
      };
    });
    await a.locator('#btn-create-event-top').click();
    await a.locator('#input-event-title').fill('Failed write');
    await a.locator('#btn-save-event-form').click();
    await a
      .getByRole('alert')
      .filter({ hasText: 'QuotaExceededError' })
      .first()
      .waitFor();
    assert.equal(await a.locator('#modal-event-form').count(), 1);
    assert.ok(
      !(await records(a)).some((r) => r.event?.title === 'Failed write'),
    );
    await a.evaluate(() => window.restoreWrite());
    await a.keyboard.press('Escape');
    await a.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        new Promise((resolve) => {
          window.resolveCamera = () => {
            const canvas = document.createElement('canvas');
            const stream = canvas.captureStream(5);
            window.cameraTrack = stream.getVideoTracks()[0];
            resolve(stream);
          };
        });
    });
    await a.locator('#btn-open-sync').click();
    await a.getByRole('button', { name: 'Skanuj', exact: true }).click();
    await a
      .getByRole('button', { name: 'Uruchom aparat', exact: true })
      .click();
    await a.waitForFunction(() => !!window.resolveCamera);
    await a.keyboard.press('Escape');
    await a.evaluate(() => window.resolveCamera());
    await a.waitForFunction(() => window.cameraTrack.readyState === 'ended');
    console.log(
      'PASS cross-tab concurrent edits, deletion sync, failed-write recovery and delayed camera cleanup',
    );
    await shared.close();
    const locked = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
    });
    await locked.addInitScript((security) => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      localStorage.setItem(
        'offline_calendar_settings_v2',
        JSON.stringify({
          language: 'pl',
          security: { ...security, pinEnabled: true, autoLockMinutes: 1 },
        }),
      );
    }, security);
    const l = await locked.newPage();
    await l.clock.install({ time: new Date('2026-10-18T10:00:00Z') });
    await l.goto(base);
    for (const digit of ['1', '2', '3', '4'])
      await l.getByRole('button', { name: digit, exact: true }).click();
    await l.locator('#btn-create-event-top').waitFor();
    await l.clock.fastForward(70000);
    await l.getByRole('heading', { name: 'Kalendarz zablokowany' }).waitFor();
    await locked.close();
    console.log('PASS inactivity auto-lock');
    for (const width of [320, 390, 768]) {
      const mobile = await browser.newContext({
        serviceWorkers: 'block',
        viewport: { width, height: 844 },
      });
      const p = await mobile.newPage();
      await p.goto(base);
      await p.locator('#btn-open-settings').waitFor();
      const clipped = await p.locator('header button').evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const r = node.getBoundingClientRect();
            return r.width > 0 && (r.left < 0 || r.right > innerWidth + 1);
          })
          .map((n) => n.id),
      );
      assert.deepEqual(clipped, [], `clipped controls at ${width}px`);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
        `outer page overflow at ${width}px`,
      );
      await p.locator('#btn-open-settings').click();
      await p.locator('#modal-settings').waitFor();
      await mobile.close();
    }
    console.log('PASS responsive controls at 320/390/768px');
    const stress = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'Europe/Warsaw',
    });
    await stress.addInitScript(() => {
      const events = Array.from({ length: 10000 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 0, 1 + (i % 365)))
          .toISOString()
          .slice(0, 10);
        return {
          id: 'bench-' + i,
          title: 'Event ' + i,
          startDate: date,
          endDate: date,
          startTime: '10:00',
          endTime: '11:00',
          allDay: false,
          color: 'peacock',
          recurrence: i % 10 === 0 ? 'WEEKLY' : 'NONE',
          reminders: [],
          createdAt: 1,
          updatedAt: 1,
        };
      });
      localStorage.setItem(
        'offline_calendar_events_v2',
        JSON.stringify(events),
      );
    });
    const p = await stress.newPage();
    await p.clock.setFixedTime(new Date('2026-10-18T10:00:00Z'));
    await p.goto(base);
    await p.locator('#btn-view-agenda').waitFor();
    const elapsed = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const start = performance.now();
          document.querySelector('#btn-view-agenda').click();
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve(Math.round(performance.now() - start)),
            ),
          );
        }),
    );
    const elements = await p.locator('main *').count();
    assert.ok(elements < 2000, `too many agenda elements: ${elements}`);
    console.log(
      `PASS 10k-event agenda: ${elapsed} ms, ${elements} DOM elements`,
    );
    await stress.close();
    const offline = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const off = await offline.newPage();
    await off.goto(base);
    await off.locator('#btn-create-event-top').waitFor();
    await off.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await off.reload();
    await off.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offline.setOffline(true);
    await off.reload();
    await off.locator('#btn-create-event-top').click();
    await off.locator('#input-event-title').fill('Offline event');
    await off.locator('#btn-save-event-form').click();
    await off.getByText('Offline event', { exact: true }).waitFor();
    await off.locator('#btn-open-sync').click();
    await off.getByLabel('Sync password', { exact: true }).fill('Offline regression QR password');
    await off.getByRole('button', { name: 'Generate encrypted code', exact: true }).click();
    await off.getByRole('img', { name: 'Sync QR' }).waitFor();
    console.log(
      'PASS offline reload, lazy-loaded event form/sync and IndexedDB persistence',
    );
    await offline.close();
  } catch (error) {
    console.error(serverLog);
    throw error;
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
