const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync } = require('node:fs');
const base = process.env.CALENDAR_TEST_URL || 'http://127.0.0.1:4176';
const event = (i = 0) => ({ id: `private-${i}`, title: i ? `Private ${i} ${crypto.randomUUID()}` : 'Encrypted private event', startDate: '2026-10-22', endDate: '2026-10-22', startTime: '10:00', endTime: '11:00', allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1 });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  const errors = [];
  async function context({ language = 'en', events = [], mobile = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: 900 }, hasTouch: mobile, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
    await ctx.addInitScript(({ language, events }) => {
      if (!localStorage.getItem('offline_calendar_settings_v2')) {
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language, theme: 'dark' }));
        localStorage.setItem('offline_calendar_events_v2', JSON.stringify(events));
      }
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedSyncCode = value; } } });
    }, { language, events });
    const page = await ctx.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-21T08:00:00+02:00'));
    await page.goto(base);
    await page.locator('#btn-open-settings').waitFor();
    return { ctx, page };
  }
  const dateKey = page => page.getByTestId('calendar-navigation').getAttribute('data-date-key');
  const section = process.env.FEATURE_TEST_SECTION;
    const expected = { year: '2027-10-21', month: '2026-11-21', week: '2026-10-28', day: '2026-10-22', agenda: '2026-11-21' };
  try {
    if (!section || section === 'desktop') {
    const { ctx, page } = await context({ events: [event()] });
    for (const view of Object.keys(expected)) {
      await page.locator(`#btn-view-${view}`).click(); await page.locator('#btn-nav-today').click();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(value => document.querySelector('[data-testid="calendar-navigation"]').dataset.dateKey.startsWith(value), expected[view]);
      await page.keyboard.press('a'); assert.equal((await dateKey(page)).split(':')[0], '2026-10-21');
      await page.keyboard.press('d'); assert.ok((await dateKey(page)).startsWith(expected[view]));
      await page.keyboard.press('ArrowLeft');
      const before = await dateKey(page);
      await page.keyboard.press('Control+ArrowRight'); assert.equal(await dateKey(page), before);
    }
    await page.locator('#btn-open-settings').click();
    await page.getByRole('button', { name: 'Create theme', exact: true }).click();
    const name = page.getByLabel('Theme name', { exact: true });
    const before = await dateKey(page);
    await name.fill('Personal theme AD'); await name.press('ArrowLeft'); await name.type('ad');
    assert.equal(await dateKey(page), before);
    await name.fill('Personal theme');
    for (const [label, color] of [['Background', '#112233'], ['Text', '#eeeeee'], ['Buttons', '#772255'], ['Accent', '#22cc99']]) await page.getByLabel(label, { exact: true }).fill(color);
    await page.getByRole('button', { name: 'Save theme', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme.startsWith('custom:'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim()), '#112233');
    await page.keyboard.press('Escape'); await page.reload(); await page.locator('#btn-open-settings').waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).customThemes[0].name), 'Personal theme');
    for (const view of Object.keys(expected)) {
      await page.locator(`#btn-view-${view}`).click();
      assert.equal(await page.locator('.theme-bg').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(17, 34, 51)');
      assert.equal(await page.locator('#btn-create-event-top').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(119, 34, 85)');
    }
    await page.locator('#btn-open-settings').click();
    await page.getByRole('button', { name: 'Edit theme: Personal theme', exact: true }).click();
    await page.getByLabel('Background', { exact: true }).fill('#223344');
    await page.getByRole('button', { name: 'Save theme', exact: true }).click();
    await page.getByRole('button', { name: 'Delete theme: Personal theme', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg-main')), '');
    await page.keyboard.press('Escape');
    // Editing outside a modal must also block calendar shortcuts.
    await page.evaluate(() => { const input = document.createElement('div'); input.contentEditable = 'true'; input.id = 'editing-test'; input.textContent = 'Editing'; document.body.append(input); input.focus(); });
    const editableBefore = await dateKey(page); await page.keyboard.press('d'); await page.keyboard.press('ArrowRight');
    assert.equal(await dateKey(page), editableBefore);
    await page.evaluate(() => document.querySelector('#editing-test').remove());
    await ctx.close();
    console.log('PASS desktop keys, modifier/editing/modal exclusions, custom theme CRUD/persistence/all views and built-in fallback.');

    }
    if (!section || section === 'touch') {
    const touch = await context({ mobile: true, events: [event()] });
    const session = await touch.ctx.newCDPSession(touch.page);
    async function swipe(x1, y1, x2, y2, duration = 0) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      for (let i = 1; i <= 6; i++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2-x1)*i/6, y: y1 + (y2-y1)*i/6 }] });
        if (duration) await touch.page.waitForTimeout(duration / 6);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    const labels = { year: 'Year', month: 'Month', week: 'Week', day: 'Day', agenda: 'Schedule' };
    for (const view of Object.keys(expected)) {
      await touch.page.getByRole('navigation', { name: 'Calendar views', exact: true }).getByRole('button', { name: new RegExp(`${labels[view]}$`) }).click();
      await touch.page.locator('#btn-nav-today').click();
      const weekBefore = view === 'week' ? await dateKey(touch.page) : null;
      const scrollBefore = view === 'week' ? await touch.page.locator('.calendar-week-scroller').evaluate(n => n.scrollLeft) : 0;
      await swipe(330, 330, 65, 333);
      if (view === 'week') {
        assert.equal(await dateKey(touch.page), weekBefore, 'panning the week must retain its dates');
        await touch.page.waitForFunction(before => document.querySelector('.calendar-week-scroller').scrollLeft !== before, scrollBefore);
        await touch.page.locator('#btn-nav-next').click();
      }
      await touch.page.waitForFunction(value => document.querySelector('[data-testid="calendar-navigation"]').dataset.dateKey.startsWith(value), expected[view]);
      assert.equal(await touch.page.getByRole('dialog').count(), 0, 'swipe must not click the event underneath');
      if (view === 'week') await touch.page.locator('#btn-nav-prev').click();
      else await swipe(65, 330, 330, 332);
      assert.ok((await dateKey(touch.page)).startsWith('2026-10-21'));
      const before = await dateKey(touch.page); await swipe(180, 620, 184, 320); assert.equal(await dateKey(touch.page), before);
    }
    await touch.page.getByRole('navigation', { name: 'Calendar views', exact: true }).getByRole('button', { name: 'Month', exact: true }).click();
    await touch.page.locator('#btn-nav-today').click();
    await swipe(330, 330, 65, 333, 1600);
    assert.ok((await dateKey(touch.page)).startsWith(expected.month), 'slow gestures remain valid');
    await touch.ctx.close();
    console.log('PASS touch period swipes, internal week panning with period buttons, reverse navigation, vertical-scroll exclusion and no accidental click.');

    }
    if (!section || section === 'sync') {
    const sender = await context({ events: Array.from({ length: 80 }, (_, i) => event(i)) });
    await sender.page.locator('#btn-open-sync').click();
    await sender.page.getByRole('button', { name: 'Text code', exact: true }).click();
    await sender.ctx.setOffline(true);
    const secret = 'Offline shared secret 123!';
    await sender.page.getByLabel('Sync password', { exact: true }).fill(secret);
    await sender.page.getByRole('button', { name: 'Generate encrypted code', exact: true }).click();
    await sender.page.getByRole('button', { name: 'Copy my code', exact: true }).click();
    const code = await sender.page.evaluate(() => window.copiedSyncCode);
    assert.ok(code.startsWith('KAL3:'));
    assert.equal(await sender.page.getByLabel('Sync password', { exact: true }).inputValue(), '');
    assert.ok(!(await sender.page.evaluate(() => JSON.stringify({ ...localStorage }))).includes(secret));
    await sender.page.getByRole('button', { name: 'Show QR', exact: true }).click();
    await sender.page.getByAltText('Sync QR', { exact: true }).waitFor();
    const totalFrames = Number((await sender.page.getByText(/^1\/\d+$/).textContent()).split('/')[1]);
    const qrImages = [];
    for (let i = 0; i < totalFrames; i++) {
      const source = await sender.page.getByAltText('Sync QR', { exact: true }).getAttribute('src');
      qrImages.push(Buffer.from(source.split(',')[1], 'base64'));
      if (i + 1 < totalFrames) {
        await sender.page.getByRole('button', { name: 'Next QR', exact: true }).click();
        await sender.page.waitForFunction(old => { const image = document.querySelector('img[alt="Sync QR"]'); return image && image.src !== old; }, source);
      }
    }
    assert.ok(qrImages.length > 1, 'exercise multipart QR images');
    const receiver = await context({ language: 'pl', mobile: true });
    await receiver.page.locator('#btn-open-sync').click();
    await receiver.page.getByRole('button', { name: 'Skanuj', exact: true }).click();
    await receiver.ctx.setOffline(true);
    for (let i = 0; i < qrImages.length; i++) {
      await receiver.page.getByLabel('Wczytaj zdjęcie QR', { exact: true }).setInputFiles({ name: `frame-${i}.png`, mimeType: 'image/png', buffer: qrImages[i] });
      if (i + 1 < qrImages.length) await receiver.page.getByRole('status').filter({ hasText: `${i+1}/${qrImages.length}` }).waitFor({ timeout: 5000 }).catch(async error => { console.error('QR image status:', await receiver.page.getByRole('status').allTextContents()); throw error; });
    }
    await receiver.page.getByLabel('Hasło nadawcy', { exact: true }).fill('wrong password');
    await receiver.page.getByRole('button', { name: 'Odszyfruj i scal', exact: true }).click();
    await receiver.page.getByText('Nieprawidłowe hasło lub uszkodzone zaszyfrowane dane.', { exact: true }).waitFor();
    assert.equal(await receiver.page.evaluate(async () => { const request = indexedDB.open('offline-calendar'); const db = await new Promise(resolve => request.onsuccess = () => resolve(request.result)); return new Promise(resolve => { const query = db.transaction('records').objectStore('records').getAll(); query.onsuccess = () => { db.close(); resolve(query.result.filter(record => record.event?.id.startsWith('private-')).length); }; }); }), 0);
    await receiver.page.getByLabel('Hasło nadawcy', { exact: true }).fill(secret);
    await receiver.page.getByRole('button', { name: 'Odszyfruj i scal', exact: true }).click();
    await receiver.page.getByText('Zapisano i scalono dane.', { exact: true }).waitFor();
    assert.ok(!(await receiver.page.evaluate(() => JSON.stringify({ ...localStorage }))).includes(secret));
    await receiver.ctx.setOffline(false); await receiver.page.keyboard.press('Escape'); await receiver.page.reload();
    await receiver.page.locator('#btn-open-search').click();
    await receiver.page.getByPlaceholder('Szukaj wydarzeń, osób, miejsc...').fill('Encrypted private event');
    await receiver.page.getByRole('dialog').getByText('Encrypted private event', { exact: true }).waitFor();
    await sender.ctx.close(); await receiver.ctx.close();
    assert.deepEqual(errors, []);
    console.log('PASS fully offline gzip/encrypted QR generation, English desktop → Polish mobile decryption, wrong-password isolation, retry/merge/persistence and no stored passwords.');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
