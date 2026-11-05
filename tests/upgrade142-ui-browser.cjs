// Actual 1.4.2 Web assets -> candidate, same origin/storage. Not an APK install test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const oldZip = path.resolve('release/part1-beta1-final/previous-1.4.2-web.zip');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(oldZip)).digest('hex'), '2af8054115f0f688b700611718275a26a2d241e4dc54b13e8f378be50b5cc676');
let directory = path.resolve('release/part1-beta1-final/previous-web');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(directory, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(4187, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-05T10:00:00Z'));
    await page.goto('http://127.0.0.1:4187');
    await page.locator('#btn-create-event-top').click();
    await page.locator('#input-event-title').fill('Upgrade 142 preserved');
    await page.locator('#input-event-location').fill('Existing location');
    await page.locator('#input-event-description').fill('Keep all event fields');
    await page.locator('#btn-save-event-form').click();
    await page.locator('#input-event-title').waitFor({ state: 'detached' });
    await page.locator('#btn-open-settings').click();
    await page.getByRole('button', { name: 'Polski', exact: true }).click();
    await page.keyboard.press('Escape');
    const before = await page.evaluate(async () => {
      const open = name => new Promise((ok, no) => { const r = indexedDB.open(name); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      const db = await open('offline-calendar');
      const records = await new Promise(ok => { db.transaction('records').objectStore('records').getAll().onsuccess = e => ok(e.target.result); }); db.close();
      const model = 'kalendarz-qwen35-v2-q4-k-m';
      localStorage.setItem('calendar_active_ai_model_v1', model);
      localStorage.setItem('calendar_default_model_migration_v142', model);
      const r = indexedDB.open('calendar-ai-chats', 1);
      r.onupgradeneeded = () => {
        const c = r.result.createObjectStore('chats', { keyPath: 'id' }); c.createIndex('updated', ['updatedAt', 'id']);
        const m = r.result.createObjectStore('messages', { keyPath: ['chatId', 'id'] }); m.createIndex('order', ['chatId', 'sequence', 'id']); m.createIndex('chat', 'chatId');
      };
      const chat = await new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      const tx = chat.transaction(['chats', 'messages'], 'readwrite');
      tx.objectStore('chats').put({ id: 'upgrade142', title: 'Existing AI history', autoTitle: false, createdAt: 1, updatedAt: 1, modelIds: [model], selectedModelId: model, nextSequence: 1 });
      tx.objectStore('messages').put({ chatId: 'upgrade142', id: 'message142', sequence: 0, role: 'user', content: 'Zachowaj historię 1.4.2', timestamp: 1, modelId: model });
      await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = no; }); chat.close();
      localStorage.setItem('calendar_active_chat_v1', 'upgrade142');
      return { event: records.find(r => r.event?.title === 'Upgrade 142 preserved').event, count: records.filter(r => r.event).length, settings: JSON.parse(localStorage.getItem('offline_calendar_settings_v2')) };
    });
    directory = path.resolve('dist');
    await page.reload();
    await page.locator('#btn-open-settings').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'pl');
    const after = await page.evaluate(async id => {
      const r = indexedDB.open('offline-calendar'); const db = await new Promise(ok => r.onsuccess = () => ok(r.result));
      const event = await new Promise(ok => db.transaction('records').objectStore('records').get(id).onsuccess = e => ok(e.target.result.event)); db.close();
      return { event, settings: JSON.parse(localStorage.getItem('offline_calendar_settings_v2')), model: localStorage.getItem('calendar_active_ai_model_v1') };
    }, before.event.id);
    assert.deepEqual(after.event, before.event); assert.deepEqual(after.settings, before.settings); assert.equal(after.model, 'kalendarz-qwen35-v2-q4-k-m');
    await page.locator('#btn-open-settings').click();
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Pełna kopia wydarzeń JSON', exact: true }).click();
    const backup = await pendingDownload, backupFile = await backup.path();
    const exported = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert.deepEqual(exported.events.find(e => e.id === before.event.id), JSON.parse(JSON.stringify(before.event)));
    await page.locator('input[type=file][accept*=".ics"]').setInputFiles({ name: 'upgrade142.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.getByText(/Pomyślnie zaimportowano/).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#btn-open-ai-assistant').click();
    await page.getByText('Zachowaj historię 1.4.2', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS official 1.4.2 Web -> part 1: event fields/settings/language, Qwen v2 choice and AI history preserved; JSON export/import remains available. No APK-install or inference claim.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
