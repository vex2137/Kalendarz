const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.ASSISTANT_TEST_URL || 'http://127.0.0.1:4176';
async function stored(page) {
  return page.evaluate(async () => {
    const open = indexedDB.open('offline-calendar');
    const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('records').objectStore('records').getAll();
        request.onsuccess = () => resolve(request.result.filter(r => r.event).map(r => r.event));
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}
async function until(check) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error('Timed out waiting for calendar persistence');
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ timezoneId: 'Europe/Warsaw', viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { if (!localStorage.getItem('offline_calendar_events_v2')) localStorage.setItem('offline_calendar_events_v2', '[]'); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-20T08:00:00+02:00'));
    await page.goto(base);
    await page.locator('#btn-open-ai-assistant').waitFor();
    assert.equal(await page.title(), 'Calendar');
    const send = async text => {
      await page.locator('#drawer-ai-assistant input').fill(text);
      await page.locator('#btn-send-ai-message').click();
    };
    const confirm = () => page.locator('[id^="btn-confirm-ai-event-"]').last().click();
    await page.locator('#btn-open-ai-assistant').click();
    await send('Schedule three one-hour workouts next week');
    await page.getByText('I prepared 3 drafts', { exact: false }).waitFor();
    assert.equal((await stored(page)).length, 0);
    await confirm();
    await until(async () => (await stored(page)).length === 3);
    await page.locator('#btn-undo-ai').click();
    await until(async () => (await stored(page)).length === 0);
    await send('Add dentist tomorrow at 3pm');
    await confirm();
    await until(async () => (await stored(page)).length === 1);
    const before = (await stored(page))[0];
    await send('Move dentist to Friday at 4pm');
    await page.getByText('Proposed reschedule', { exact: true }).waitFor();
    assert.equal((await stored(page))[0].startDate, before.startDate);
    await confirm();
    await until(async () => (await stored(page))[0].startDate === '2026-10-23');
    assert.equal((await stored(page))[0].id, before.id);
    assert.equal((await stored(page))[0].startTime, '16:00');
    await page.locator('#btn-close-ai-drawer').click();
    await page.locator('#btn-open-ai-assistant').click();
    await page.locator('#btn-undo-ai').click();
    await until(async () => (await stored(page))[0].startDate === before.startDate);
    await page.locator('#btn-close-ai-drawer').click();
    await page.locator('#btn-open-settings').click();
    await page.getByRole('button', { name: /Polski/ }).click();
    await until(async () => await page.title() === 'Kalendarz');
    await page.getByLabel('Początek dnia').fill('09:00');
    await page.getByLabel('Koniec dnia').fill('17:00');
    await page.getByText('Przerwa między wydarzeniami (min)', { exact: true }).locator('input').fill('15');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#btn-open-ai-assistant').waitFor();
    assert.equal(await page.title(), 'Kalendarz');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).ai.planning.bufferMinutes), 15);
    await page.locator('#btn-open-ai-assistant').click();
    await send('Zaplanuj trzy godzinne treningi w przyszłym tygodniu');
    await confirm();
    await until(async () => (await stored(page)).length === 4);
    assert.equal((await stored(page)).filter(e => e.title === 'Trening').length, 3);
    await page.locator('#btn-undo-ai').click();
    await until(async () => (await stored(page)).length === 1);
    await page.locator('#btn-close-ai-drawer').click();
    await page.locator('#btn-open-settings').click();
    await page.getByRole('button', { name: 'Русский', exact: true }).click();
    await until(async () => await page.title() === 'Календарь');
    assert.equal(await page.getByRole('button', { name: 'Русский', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: /English/ }).getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#btn-open-ai-assistant').waitFor();
    assert.equal(await page.title(), 'Календарь');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.locator('#btn-open-ai-assistant').click();
    await send('Добавь встречу завтра в 15 на 30 минут');
    await page.getByText('Предложенные события', { exact: true }).waitFor();
    await confirm();
    await until(async () => (await stored(page)).length === 2);
    const ruBefore = (await stored(page)).find(e => e.title === 'Встреча');
    assert.equal(ruBefore.startTime, '15:00');
    await send('Перенеси встречу на пятницу в 16');
    await page.getByText('Предложенный перенос', { exact: true }).waitFor();
    await confirm();
    await until(async () => (await stored(page)).find(e => e.id === ruBefore.id).startDate === '2026-10-23');
    await page.locator('#btn-undo-ai').click();
    await until(async () => (await stored(page)).find(e => e.id === ruBefore.id).startDate === ruBefore.startDate);
    await send('Найди встречу');
    await page.getByText(/Найденные события/).first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: English defaults, language switching, planning preferences, PL/EN/RU, persisted Russian selection, batch confirmation, rescheduling, undo and persistence.');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
