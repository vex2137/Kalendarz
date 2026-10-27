const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:4193';
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4193', '--strictPort'], { env: { ...process.env, DISABLE_HMR: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', browser;
  server.stdout.on('data', data => log += data); server.stderr.on('data', data => log += data);
  const errors = [];
  try {
    for (let i = 0; ; i++) {
      if (await fetch(base).then(r => r.ok).catch(() => false)) break;
      if (i === 100) throw Error(log);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
    for (const language of ['en', 'pl', 'de', 'ru']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 450 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
      await context.addInitScript(language => {
        localStorage.setItem('offline_calendar_events_v2', '[]');
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language }));
      }, language);
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.locator('#btn-mobile-fab-create').click();
      await page.locator('#input-event-title').waitFor();
      const labels = {
        en: ['Start date', 'Start time', 'End date', 'End time'],
        pl: ['Data początku', 'Godzina początku', 'Data końca', 'Godzina końca'],
        de: ['Startdatum', 'Startzeit', 'Enddatum', 'Endzeit'],
        ru: ['Дата начала', 'Время начала', 'Дата окончания', 'Время окончания'],
      };
      for (const label of labels[language]) assert.equal(await page.getByLabel(label, { exact: true }).count(), 1);
      for (const color of await page.locator('.event-color-choice').all()) {
        const box = await color.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
        assert.ok(await color.getAttribute('aria-label'));
      }
      await page.locator('#color-choice-banana').click();
      assert.equal(await page.locator('#color-choice-banana').getAttribute('aria-pressed'), 'true');
      await page.locator('#select-recurrence').selectOption('CUSTOM');
      const weekday = page.locator('.event-weekday-choice').first();
      assert.equal(await weekday.getAttribute('aria-pressed') !== null, true);
      assert.ok((await weekday.boundingBox()).height >= 44);
      await page.locator('#btn-add-reminder').click();
      assert.equal(await page.locator('#btn-add-reminder').getAttribute('aria-expanded'), 'true');
      assert.ok(await page.locator('form').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      await page.locator('#input-event-title').fill('Keep this draft');
      await page.locator('#input-start-time').fill('10:00');
      await page.locator('#input-end-time').fill('09:00');
      await page.locator('#btn-save-event-form').click();
      const alert = page.locator('.calendar-form-error');
      await alert.waitFor(); assert.equal(await alert.evaluate(n => n === document.activeElement), true);
      assert.equal(await page.locator('#input-event-title').inputValue(), 'Keep this draft');
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 2);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.closest('[role="dialog"]').getAttribute('aria-label')), await page.getByRole('dialog').last().getAttribute('aria-label'));
      await context.close();
    }
    console.log('PASS 4 languages, localized focused errors, 44px color/day controls, nested focus and 320x450 high-DPI dialog reflow');

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ id: `color-${i}`, title: `Title ${i}`, description: 'Description', location: 'Location', startDate: '2027-02-15', endDate: '2027-02-15', startTime: `${String(8 + i).padStart(2, '0')}:00`, endTime: `${String(9 + i).padStart(2, '0')}:00`, allDay: false, color: ['tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil', 'peacock', 'blueberry', 'lavender', 'grape', 'graphite'][i], recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1 }))));
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'agenda' }));
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2027-02-15T09:15:00Z'));
    await page.goto(base); await page.locator('.calendar-event-card').first().waitFor();
    const failures = [];
    async function contrast(selector, theme) {
      failures.push(...await page.locator(selector).evaluateAll((nodes, theme) => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const rgb = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const lum = color => color.slice(0, 3).map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        return nodes.filter(n => n.getClientRects().length && n.textContent.trim()).flatMap(n => {
          let background = [0, 0, 0, 0], parent = n;
          while (parent && background[3] === 0) { background = rgb(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; }
          const a = lum(rgb(getComputedStyle(n).color)), b = lum(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          return ratio < 4.5 ? [`${theme}: ${n.className} ${ratio.toFixed(2)}`] : [];
        });
      }, theme));
    }
    for (const theme of ['light', 'dark', 'nord', 'emerald', 'sunset', 'lavender', 'moka']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.locator('#btn-view-agenda').click();
      await contrast('.calendar-event-title, .calendar-event-meta, .calendar-event-description, .calendar-event-time', theme);
      await page.locator('.calendar-event-card').first().hover();
      await contrast('.calendar-event-card:first-child .calendar-event-meta', `${theme}/hover`);
      await page.locator('#btn-view-month').click();
      await contrast('.month-number, .month-count, .month-overflow, .month-weekdays span, .month-segment', theme);
      await page.locator('#btn-view-year').click();
      await contrast('.year-weekdays span, .year-dates button', theme);
      await page.locator('#btn-view-day').click();
      await contrast('.timeline-date span, .timeline-date strong, .timeline-hours span, .timeline-event strong, .timeline-event span, .calendar-view-button', theme);
    }
    if (failures.length) console.log('CONTRAST', [...new Set(failures)].join('\n'));
    assert.deepEqual(failures, []);
    console.log('PASS sampled calendar text contrast >=4.5:1 for seven built-in themes and eleven event colors, including card hover');

    await page.locator('#btn-create-event-top').click();
    await page.locator('#input-event-title').fill('Failed write');
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      window.restoreWrite = () => IDBObjectStore.prototype.put = original;
      IDBObjectStore.prototype.put = function (value, ...args) {
        if (value.event?.title === 'Failed write') throw new DOMException('Test disk full', 'QuotaExceededError');
        return original.call(this, value, ...args);
      };
    });
    await page.locator('#btn-save-event-form').click();
    await page.locator('.calendar-form-error').waitFor();
    assert.match(await page.locator('.calendar-form-error').innerText(), /Your changes remain.*QuotaExceededError/);
    assert.equal(await page.locator('#input-event-title').inputValue(), 'Failed write');
    await page.evaluate(() => window.restoreWrite());
    await page.locator('#input-event-title').fill('Pending save');
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put; window.holdWrite = true;
      IDBObjectStore.prototype.put = function (value, ...args) {
        const request = original.call(this, value, ...args);
        if (value.event?.title === 'Pending save') {
          const keepAlive = () => { if (window.holdWrite) this.get('__hold_write__').onsuccess = keepAlive; };
          keepAlive();
        }
        return request;
      };
    });
    await page.locator('#btn-save-event-form').click();
    assert.equal(await page.locator('#input-event-title').isDisabled(), true);
    assert.equal(await page.locator('#btn-close-event-modal').isDisabled(), true);
    await page.evaluate(() => { document.querySelector('#modal-event-form form').requestSubmit(); window.holdWrite = false; });
    await page.locator('#modal-event-form').waitFor({ state: 'detached' });
    const items = await page.evaluate(async () => (await (await import('/src/utils/calendarStore.ts')).loadCalendar()).events);
    assert.equal(items.filter(e => e.title === 'Pending save').length, 1);
    assert.equal(items.some(e => e.title === 'Failed write'), false);
    await context.close();
    assert.deepEqual(errors, []);
    console.log('PASS failed-write draft retention, disabled fields during delayed commit, duplicate submit protection and zero browser errors');
  } catch (error) { console.error(log.slice(-1000)); throw error; }
  finally { await browser?.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
