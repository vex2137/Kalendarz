const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync, mkdirSync } = require('node:fs');
const { spawn } = require('node:child_process');
const base = 'http://127.0.0.1:4185';
const fixture = patch => ({ id: 'base', title: 'Meeting', startDate: '2027-02-15', endDate: '2027-02-15', startTime: '09:00', endTime: '12:00', allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1, ...patch });
const events = [
  fixture({ id: 'cross-month', title: 'Across January and February', startDate: '2027-01-30', endDate: '2027-02-03', allDay: true, color: 'banana' }),
  fixture({ id: 'cross-week', title: 'Across two weeks', startDate: '2027-02-05', endDate: '2027-02-10', allDay: true, color: 'sage' }),
  fixture({ id: 'overnight', title: 'Night shift', startDate: '2027-02-07', endDate: '2027-02-08', startTime: '23:00', endTime: '01:00' }),
  fixture({ id: 'a', title: 'First overlap', description: 'Long description '.repeat(20) }),
  fixture({ id: 'b', title: 'Second overlap', startTime: '10:00', endTime: '11:00', color: 'banana' }),
  fixture({ id: 'c', title: 'Third overlap', startTime: '10:30', endTime: '13:00', color: 'flamingo' }),
  fixture({ id: 'all-day', title: 'All-day banner', allDay: true }),
  ...Array.from({ length: 6 }, (_, i) => fixture({ id: `all-day-${i}`, title: `Daily note ${i}`, startDate: `2027-02-${16 + i}`, endDate: `2027-02-${16 + i}`, allDay: true })),
  fixture({ id: 'weekly', title: 'Recurring Monday', startDate: '2027-02-01', endDate: '2027-02-01', startTime: '14:00', endTime: '15:00', recurrence: 'WEEKLY' }),
];
async function until(fn) { const end = Date.now() + 20000; while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); } throw Error('Condition timed out'); }
async function records(page) { return page.evaluate(async () => { const { loadCalendar } = await import('/src/utils/calendarStore.ts'); return (await loadCalendar()).events; }); }
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4185', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DISABLE_HMR: 'true' } });
  let log = ''; server.stdout.on('data', d => log += d); server.stderr.on('data', d => log += d);
  let browser;
  try {
    await until(async () => { try { return (await fetch(base)).ok; } catch { return false; } });
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    await context.addInitScript(data => {
      if (!localStorage.getItem('offline_calendar_events_v2')) {
        localStorage.setItem('offline_calendar_events_v2', JSON.stringify(data));
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', theme: 'dark', defaultReminder: 0 }));
      }
    }, events);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2027-02-15T09:15:00Z'));
    await page.goto(base);
    await page.locator('[data-testid=month-week]').first().waitFor();
    assert.equal(await page.locator('[data-testid=month-week]').count(), 4);
    assert.match(await page.locator('#month-events-heading').innerText(), /Upcoming events/);
    await page.locator('#calendar-cell-2027-02-02').click();
    assert.equal(await page.locator('#calendar-cell-2027-02-02').getAttribute('aria-pressed'), 'true');
    await page.locator('.month-agenda .calendar-event-card[data-event-id="cross-month"]').waitFor();
    await page.locator('#calendar-cell-2027-02-02').click();
    assert.equal(await page.locator('#calendar-cell-2027-02-02').getAttribute('aria-pressed'), 'false');
    await page.locator('#calendar-cell-2027-02-04').click();
    await page.getByText('No events on this day', { exact: true }).waitFor();
    await page.locator('#btn-nav-today').click();
    assert.equal(await page.locator('[aria-pressed=true].month-date').count(), 0);
    await page.locator('#btn-nav-next').click();
    assert.equal(await page.locator('[aria-pressed=true].month-date').count(), 0);
    assert.match(await page.locator('#month-events-heading').innerText(), /Upcoming events/);
    await page.locator('#calendar-cell-2027-04-01 .month-number').click();
    assert.equal(await page.locator('[data-testid=month-view]').getAttribute('data-month'), '2027-03');
    await page.locator('#btn-view-day').click();
    assert.equal(await page.locator('.timeline-date').getAttribute('data-date'), '2027-04-01');
    await page.locator('#btn-view-month').click(); // April has five rows.
    assert.equal(await page.locator('[data-testid=month-week]').count(), 5);
    await page.locator('#btn-nav-next').click(); // May has six rows.
    assert.equal(await page.locator('[data-testid=month-week]').count(), 6);
    await page.locator('#btn-nav-today').click();
    const segments = page.locator('.month-segment[data-event-id="cross-week"]');
    assert.equal(await segments.count(), 2);
    assert.deepEqual(await segments.evaluateAll(nodes => nodes.map(n => [n.dataset.start, n.dataset.end])), [['4', '6'], ['0', '2']]);
    for (const segment of await segments.all()) {
      await segment.click();
      await until(async () => (await page.locator('#input-start-date').inputValue()) === '2027-02-05');
      assert.equal(await page.locator('#input-event-title').inputValue(), 'Across two weeks');
      await page.keyboard.press('Escape');
    }
    assert.equal((await records(page)).length, events.length);
    console.log('PASS month 4/5/6 rows, select/deselect, empty day, month reset, continuous segments and original record identity');

    await page.locator('#calendar-cell-2027-02-15 .month-number').click();
    await page.locator('#btn-view-day').click();
    assert.equal(await page.locator('.timeline-date').getAttribute('data-date'), '2027-02-15');
    const timeEvent = page.locator('.timeline-event[data-event-id="a"]');
    assert.equal(await timeEvent.evaluate(n => parseFloat(n.style.top)), 576);
    assert.equal(await timeEvent.evaluate(n => parseFloat(n.style.height)), 192);
    assert.equal(await page.locator('[data-testid=current-time]').evaluate(n => parseFloat(n.style.top)), 656);
    const overlap = await page.locator('.timeline-event').filter({ hasText: /overlap/ }).evaluateAll(nodes => nodes.map(n => ({ left: parseFloat(n.style.left.match(/([\d.]+)%/)[1]), width: parseFloat(n.style.width.match(/([\d.]+)%/)[1]) })));
    assert.equal(overlap.length, 3);
    assert.equal(new Set(overlap.map(n => n.left)).size, 3);
    assert.ok(overlap.every(n => n.width <= 34));
    await page.locator('.timeline-all-day-event[data-event-id="all-day"]').waitFor();
    await page.locator('#btn-nav-next').click();
    assert.equal(await page.locator('[data-testid=current-time]').count(), 0);
    await page.locator('#btn-nav-prev').click();
    await page.locator('#btn-view-week').click();
    assert.ok((await page.locator('.timeline-all-day').boundingBox()).height <= 40, 'non-overlapping all-day events across seven days use one lane');
    assert.deepEqual(await page.locator('.timeline-date').evaluateAll(nodes => nodes.map(n => n.dataset.date)), Array.from({ length: 7 }, (_, i) => `2027-02-${15 + i}`));
    console.log('PASS day/week time geometry, current-time line, overlaps, all-day events and date context');

    await page.locator('#btn-view-year').click();
    assert.equal(await page.locator('[data-testid=year-month]').count(), 12);
    await page.locator('.year-month-heading').first().click();
    assert.equal(await page.locator('[data-testid=month-view]').getAttribute('data-month'), '2027-01');
    await page.locator('#calendar-cell-2027-01-01').click();
    await page.getByRole('button', { name: 'Open day →', exact: true }).click();
    await page.locator('#btn-view-week').click();
    assert.equal(await page.locator('.timeline-date').first().getAttribute('data-date'), '2026-12-28');
    assert.equal(await page.locator('.timeline-date').last().getAttribute('data-date'), '2027-01-03');
    assert.match(await page.locator('[data-testid=calendar-heading]').innerText(), /2026.*2027/);
    await page.locator('#btn-nav-today').click();
    await page.locator('#btn-view-agenda').click();
    await page.locator('.calendar-event-card[data-event-id="weekly"]').first().waitFor();
    await page.getByRole('button', { name: 'Show next 60 days', exact: true }).click();
    assert.equal(await page.locator('[data-testid=agenda-list]').getAttribute('data-end'), '2027-06-14');
    console.log('PASS year 12 months, month/day navigation, year-boundary header, recurring agenda and range extension');

    await page.locator('#btn-create-event-top').click();
    await page.locator('#input-event-title').fill('Do not lose this draft');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await page.locator('#input-event-title').inputValue(), 'Do not lose this draft');
    await page.locator('#btn-cancel-event-form').click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await page.locator('#modal-event-form').waitFor({ state: 'detached' });
    assert.equal((await records(page)).length, events.length);
    console.log('PASS dirty dialog confirmation, keep editing, discard and no unintended writes');

    mkdirSync('/tmp/kalendarz-ui-screenshots', { recursive: true });
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      await page.setViewportSize(size);
      const nav = page.getByRole('navigation', { name: 'Calendar views', exact: true });
      for (const button of await nav.getByRole('button').all()) {
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow ${size.width}`);
        if ((await button.innerText()).trim() === 'Day') assert.ok(await page.locator('.calendar-timeline').evaluate(n => n.scrollWidth <= n.clientWidth + 1), `day overflow ${size.width}`);
      }
      // One image per phone/tablet/desktop size, all from the month view.
      await nav.getByRole('button').nth(1).click();
      await page.screenshot({ animations: 'disabled', path: `/tmp/kalendarz-ui-screenshots/month-${size.width}.png` });
    }
    // Keyboard day selection must not navigate away from the month.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#calendar-cell-2027-02-04').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#calendar-cell-2027-02-04').getAttribute('aria-pressed'), 'true');
    const focus = await page.locator('#calendar-cell-2027-02-04').evaluate(n => getComputedStyle(n).outlineStyle);
    assert.notEqual(focus, 'none');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS eight responsive sizes (320–2560px), landscape, five views, keyboard selection/focus and zero browser errors');

    const large = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await large.addInitScript(() => {
      const items = Array.from({ length: 10000 }, (_, i) => ({ id: `large-${i}`, title: `Large event ${i}`, startDate: '2027-02-15', endDate: '2027-02-15', startTime: '09:00', endTime: '10:00', allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1 }));
      localStorage.setItem('offline_calendar_events_v2', JSON.stringify(items));
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'agenda' }));
    });
    const bigPage = await large.newPage();
    bigPage.on('pageerror', e => errors.push(e.message));
    await bigPage.clock.setFixedTime(new Date('2027-02-15T09:15:00Z'));
    await bigPage.goto(base);
    await bigPage.locator('.calendar-event-card').first().waitFor();
    assert.ok(await bigPage.locator('.calendar-event-card').count() < 50);
    await bigPage.locator('[data-testid=agenda-list]').evaluate(n => { n.scrollTop = n.scrollHeight; });
    await bigPage.getByText('Large event 9999', { exact: true }).waitFor();
    assert.equal((await records(bigPage)).length, 10000);
    await large.close();
    console.log('PASS 10,000-event virtual agenda, bounded DOM, last item reachable, records preserved');

    for (const spec of [
      { date: '2026-03-29', end: '01:30', hours: 23, top: 96, height: 64 },
      { date: '2026-10-25', end: '01:15', hours: 25, top: 160, height: 48 },
    ]) {
      const dst = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
      await dst.addInitScript(spec => {
        localStorage.setItem('offline_calendar_events_v2', JSON.stringify([{ id: 'dst', title: 'Clock change appointment', startDate: spec.date, endDate: spec.date, startTime: '00:30', endTime: spec.end, allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1, timeZone: 'UTC' }]));
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'day' }));
      }, spec);
      const dstPage = await dst.newPage();
      dstPage.on('pageerror', e => errors.push(e.message));
      const cdp = await dst.newCDPSession(dstPage);
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Warsaw' });
      await dstPage.clock.setFixedTime(new Date(`${spec.date}T00:45:00Z`));
      await dstPage.goto(base);
      const block = dstPage.locator('.timeline-event[data-event-id="dst"]');
      await block.waitFor();
      assert.equal(await dstPage.locator('.timeline-hour').count(), spec.hours);
      assert.equal(await block.evaluate(n => parseFloat(n.style.top)), spec.top);
      assert.equal(await block.evaluate(n => parseFloat(n.style.height)), spec.height);
      if (spec.hours === 25) {
        assert.match(await block.getAttribute('title'), /02:30.*02:15.*UTC\+2.*UTC\+1/);
        await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
        await dstPage.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await until(async () => (await dstPage.locator('.timeline-hour').count()) === 24);
        assert.equal(await block.evaluate(n => parseFloat(n.style.top)), 32);
      }
      await dst.close();
    }
    console.log('PASS actual 23/25-hour day geometry, repeated-hour event visibility/duration and live timezone change');

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
    await touch.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'en', defaultView: 'week' }));
    });
    const touchPage = await touch.newPage();
    touchPage.on('pageerror', e => errors.push(e.message));
    await touchPage.clock.setFixedTime(new Date('2027-02-15T09:15:00Z'));
    await touchPage.goto(base);
    await touchPage.locator('.calendar-week-scroller').waitFor();
    const cdp = await touch.newCDPSession(touchPage);
    const swipe = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: 330 }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330 - i * 40, y: 331 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const before = await touchPage.getByTestId('calendar-navigation').getAttribute('data-date-key');
    await swipe();
    await until(async () => (await touchPage.locator('.calendar-week-scroller').evaluate(n => n.scrollLeft)) > 0);
    assert.equal(await touchPage.getByTestId('calendar-navigation').getAttribute('data-date-key'), before);
    await touchPage.getByRole('navigation', { name: 'Calendar views', exact: true }).getByRole('button', { name: 'Month', exact: true }).click();
    await swipe();
    await until(async () => (await touchPage.getByTestId('calendar-navigation').getAttribute('data-date-key')).startsWith('2027-03-15'));
    assert.equal(await touchPage.getByRole('dialog').count(), 0);
    await touch.close();
    console.log('PASS real touch: week pans its timeline, month changes period, neither opens an accidental dialog');
    const polish = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await polish.addInitScript(() => {
      localStorage.setItem('offline_calendar_events_v2', '[]');
      localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'pl' }));
    });
    const polishPage = await polish.newPage();
    polishPage.on('pageerror', e => errors.push(e.message));
    await polishPage.clock.setFixedTime(new Date('2027-02-15T09:15:00Z'));
    await polishPage.goto(base);
    await polishPage.locator('#calendar-cell-2027-02-04 .month-number').click();
    await polishPage.getByText('Brak wydarzeń w tym dniu', { exact: true }).waitFor();
    await polish.close();
    assert.deepEqual(errors, []);
    console.log('PASS exact Polish empty-day message and zero browser errors across all scenarios');


  } catch (e) { console.error(log.slice(-2000)); throw e; }
  finally { if (browser) await browser.close(); server.kill('SIGTERM'); }
})().catch(e => { console.error(e); process.exitCode = 1; });
