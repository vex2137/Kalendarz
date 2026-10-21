// This test requires real official weights. No mocked inference or canned responses.
const assert = require('node:assert/strict');
const { existsSync, statSync, createReadStream } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.MODEL_TEST_URL || 'http://127.0.0.1:4178';
const file = process.env.CALENDAR_MODEL_FILE;
async function wait(check, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('Real-model test timed out');
}
async function records(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('offline-calendar');
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      return await new Promise((resolve, reject) => {
        const get = db.transaction('records').objectStore('records').getAll();
        get.onsuccess = () => resolve(get.result.flatMap(r => r.event ? [r.event] : [])); get.onerror = () => reject(get.error);
      });
    } finally { db.close(); }
  });
}
(async () => {
  assert.ok(file && existsSync(file), 'Set CALENDAR_MODEL_FILE to the official LFM2.5-350M-Q4_K_M.gguf');
  assert.equal(statSync(file).size, 229312224);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  assert.equal(hash.digest('hex'), '7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4');
  const server = process.env.MODEL_TEST_URL ? undefined : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host=127.0.0.1', '--port=4178', '--strictPort'], { stdio: 'ignore' });
  let browser;
  try {
    await wait(async () => { try { return (await fetch(base)).ok; } catch { return false; } }, 15000);
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
    const context = await browser.newContext({ timezoneId: 'Europe/Warsaw' });
    await context.addInitScript(() => {
      if (!localStorage.getItem('offline_calendar_events_v2')) localStorage.setItem('offline_calendar_events_v2', '[]');
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: 'pl' }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
    await page.goto(base);
    await page.locator('#btn-open-ai-assistant').click();
    await page.getByLabel('Importuj GGUF', { exact: true }).setInputFiles(file);
    await page.getByText('Model zainstalowany • gotowy offline', { exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.reload();
    await page.locator('#btn-open-ai-assistant').click();
    const send = async text => {
      await page.locator('#drawer-ai-assistant input[type=text]').fill(text);
      await page.locator('#btn-send-ai-message').click();
    };
    const confirm = () => page.locator('[id^="btn-confirm-ai-event-"]').last();
    await send('Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00');
    await confirm().waitFor();
    assert.equal((await records(page)).length, 0, 'Inference must not write automatically');
    await confirm().click();
    await wait(async () => (await records(page)).length === 1);
    const original = (await records(page))[0];
    assert.match(original.title, /dentyst/i);
    assert.equal(original.startDate, '2026-10-22');
    assert.equal(original.startTime, '15:00');
    await send('Przenieś wydarzenie Dentysta na 2026-10-24 o 14:00');
    await confirm().waitFor();
    assert.equal((await records(page))[0].startDate, original.startDate);
    await confirm().click();
    await wait(async () => (await records(page))[0]?.startDate === '2026-10-24');
    assert.equal((await records(page))[0].startTime, '14:00');
    assert.equal((await records(page))[0].id, original.id);
    await send('Znajdź wydarzenie Dentysta');
    await wait(async () => await page.locator('#btn-send-ai-message').isEnabled() === false && await page.locator('#drawer-ai-assistant input[type=text]').isEnabled());
    assert.equal(await confirm().count(), 0);
    assert.match(await page.locator('#drawer-ai-assistant').innerText(), /2026-10-24/);
    await send('Usuń wydarzenie Dentysta');
    await page.getByRole('button', { name: 'Potwierdź usunięcie', exact: true }).waitFor();
    assert.equal((await records(page)).length, 1);
    await page.getByRole('button', { name: 'Potwierdź usunięcie', exact: true }).click();
    await wait(async () => (await records(page)).length === 0);
    await page.locator('#btn-undo-ai').click();
    await wait(async () => (await records(page)).length === 1);
    assert.deepEqual(errors, []);
    console.log('Real LFM2.5 offline Polish create/edit/search/delete/undo and model persistence passed.');
  } finally { await browser?.close(); server?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
