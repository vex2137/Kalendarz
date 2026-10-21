// Real GGUF inference inside the installed debug APK's Android System WebView.
// Requires an adb-connected device/emulator and the official model on the host.
const assert = require('node:assert/strict');
const { createReadStream, statSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { _android } = require('playwright');
const pkg = process.env.MODEL_TEST_ANDROID_PACKAGE || 'com.kalendarz.offline';
const adb = process.env.ADB || 'adb';
const file = process.env.CALENDAR_MODEL_FILE;
assert.match(pkg, /^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/);
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
  assert.ok(file, 'Set CALENDAR_MODEL_FILE to the official GGUF');
  assert.equal(statSync(file).size, 229312224);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  assert.equal(hash.digest('hex'), '7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4');
  const devices = await _android.devices();
  const device = devices.find(d => !process.env.ANDROID_SERIAL || d.serial() === process.env.ANDROID_SERIAL);
  assert.ok(device, 'Connect an Android device with the debug APK installed');
  let page;
  try {
    console.log('Testing the model bundled inside the APK; no import or model transfer');
    await device.shell(`am start -n ${pkg}/.MainActivity`);
    const view = await device.webView({ pkg }, { timeout: 180000 });
    page = await view.page();
    console.log('Connected to actual Android System WebView');
    page.setDefaultTimeout(180000);
    const context = page.context();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Warsaw' });
    const external = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('WebView:', message.text()); });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/^https?:/.test(url) && new URL(url).hostname !== 'localhost') { external.push(url); return route.abort(); }
      return route.continue();
    });
    await context.setOffline(true);
    for (const example of [
      { language: 'pl', request: 'Dodaj wydarzenie Kontrola jutro o 15:00 do 16:00', title: 'Kontrola', import: 'Importuj GGUF', installed: 'Model zainstalowany • gotowy offline' },
      { language: 'en', request: 'Add event Checkup tomorrow at 15:00 until 16:00', title: 'Checkup', import: 'Import GGUF', installed: 'Model installed • offline ready' },
    ]) {
      await page.evaluate(language => localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language })), example.language);
      await page.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
      await page.reload();
      await page.locator('#btn-open-ai-assistant').click();
      await page.getByText(example.installed, { exact: true }).waitFor();
      console.log('Android runtime:', await page.evaluate(() => JSON.stringify({ ua: navigator.userAgent, isolated: crossOriginIsolated, jspi: typeof WebAssembly.Suspending === 'function', language: document.documentElement.lang })));
      const before = await records(page), started = performance.now();
      await page.locator('#drawer-ai-assistant input[type=text]').fill(example.request);
      await page.locator('#btn-send-ai-message').click();
      await page.waitForFunction(() => !document.querySelector('#drawer-ai-assistant input[type=text]')?.disabled);
      console.log(`${example.language} Android response: ${((performance.now() - started) / 1000).toFixed(2)}s`);
      const confirm = page.locator('[id^="btn-confirm-ai-event-"]').last();
      assert.equal(await confirm.count(), 1, await page.locator('#drawer-ai-assistant').innerText());
      assert.deepEqual(await records(page), before, 'Inference must not save automatically');
      await confirm.click();
      await page.waitForFunction(async count => {
        const request = indexedDB.open('offline-calendar');
        const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
        try { return await new Promise(resolve => { const get = db.transaction('records').objectStore('records').getAll(); get.onsuccess = () => resolve(get.result.filter(r => r.event).length === count); }); }
        finally { db.close(); }
      }, before.length + 1);
      const added = (await records(page)).find(event => !before.some(existing => existing.id === event.id));
      assert.deepEqual([added.title, added.startDate, added.startTime, added.endDate, added.endTime], [example.title, '2026-10-22', '15:00', '2026-10-22', '16:00']);
      if (process.env.MODEL_TEST_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MODEL_TEST_SCREENSHOT_DIR}/android-model-${example.language}.png` });
    }
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('Real Android WebView offline Polish/English GGUF inference and model persistence passed.');
  } catch (error) {
    if (page && !page.isClosed()) console.error('Android assistant state:', await page.locator('#drawer-ai-assistant').innerText().catch(() => 'unavailable'));
    throw error;
  } finally { await device.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
