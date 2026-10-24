// This test requires real official weights. No mocked inference or canned responses.
const assert = require('node:assert/strict');
const { existsSync, statSync, createReadStream } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.MODEL_TEST_URL || 'http://127.0.0.1:4178';
const file = process.env.CALENDAR_MODEL_FILE;
const language = process.env.MODEL_TEST_LANGUAGE || 'pl';
assert.ok(['pl', 'en'].includes(language), 'MODEL_TEST_LANGUAGE must be pl or en');
const copy = language === 'pl' ? {
  import: 'Importuj GGUF', installed: 'Model zainstalowany • gotowy offline', unavailable: 'Model niedostępny', clear: 'Nowa rozmowa', delete: 'Potwierdź usunięcie', title: 'Dentysta', proposal: 'Propozycje wydarzeń',
  create: 'Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00', move: 'Przenieś wydarzenie Dentysta na 2026-10-24 o 14:00', search: 'Znajdź wydarzenie Dentysta', remove: 'Usuń wydarzenie Dentysta',
} : {
  import: 'Import GGUF', installed: 'Model installed • offline ready', unavailable: 'Model unavailable', clear: 'New conversation', delete: 'Confirm deletion', title: 'Dentist', proposal: 'Proposed events',
  create: 'Add event Dentist tomorrow at 15:00 until 16:00', move: 'Move event Dentist to 2026-10-24 at 14:00', search: 'Find event Dentist', remove: 'Delete event Dentist',
};
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
  let browser, page;
  try {
    await wait(async () => { try { return (await fetch(base)).ok; } catch { return false; } }, 15000);
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox', '--disk-cache-size=1073741824'] });
    const context = await browser.newContext({ timezoneId: 'Europe/Warsaw' });
    await context.addInitScript(language => {
      const parse = JSON.parse;
      JSON.parse = function(value, reviver) {
        if (typeof value === 'string' && /^\s*\{\s*"action"/.test(value)) console.debug('Model JSON:', value);
        const parsed = parse.call(JSON, value, reviver);
        if (parsed?.usage?.prompt_tokens) {
          console.debug('Model tokens:', JSON.stringify(parsed.usage));
        }
        return parsed;
      };
      if (!localStorage.getItem('offline_calendar_events_v2')) localStorage.setItem('offline_calendar_events_v2', '[]');
      if (!localStorage.getItem('offline_calendar_settings_v2')) localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language }));
    }, language);
    page = await context.newPage();
    page.setDefaultTimeout(180000);
    const errors = [];
    const inferenceMetrics = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => {
      if (message.type() === 'error') console.error('Browser:', message.text());
      if (message.text().startsWith('Local model performance:')) {
        const metrics = JSON.parse(message.text().slice('Local model performance:'.length));
        inferenceMetrics.push(metrics);
        console.log('Inference metrics:', JSON.stringify(metrics));
      }
      if (message.text().startsWith('Model JSON:')) console.log(message.text());
      if (message.text().startsWith('Model tokens:')) console.log(message.text());
    });
    await page.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
    await page.goto(base);
    await page.locator('#btn-open-ai-assistant').click();
    // Use the shipped model on a fresh profile: no import/download and no pre-existing IndexedDB copy.
    assert.equal(await page.evaluate(() => indexedDB.databases().then(dbs => dbs.some(db => db.name === 'calendar-local-model'))), false);
    console.log('Testing bundled GGUF on a fresh profile');
    await page.locator('[data-model-installed="true"]').waitFor();
    console.log('Bundled metadata ready; waiting for service-worker installation');
    await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((_, reject) => setTimeout(() => reject(new Error('Service-worker installation exceeded 60 seconds')), 60000))]));
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    const externalRequests = [];
    context.on('request', request => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) externalRequests.push(request.url());
    });
    await page.reload();
    await page.locator('#btn-open-ai-assistant').click();
    console.log('Browser runtime:', JSON.stringify(await page.evaluate(() => ({
      userAgent: navigator.userAgent, isolated: crossOriginIsolated,
      availableCores: navigator.hardwareConcurrency || 1,
    }))));
    const send = async text => {
      const started = performance.now();
      console.log(`Offline request: ${text}`);
      await page.evaluate(() => {
        const probe = window.modelFrameProbe = { last: performance.now(), max: 0, id: 0 };
        const tick = now => { probe.max = Math.max(probe.max, now - probe.last); probe.last = now; probe.id = requestAnimationFrame(tick); };
        probe.id = requestAnimationFrame(tick);
      });
      await page.locator('#drawer-ai-assistant input[type=text]').fill(text);
      await page.locator('#btn-send-ai-message').click();
      await page.waitForFunction(() => !document.querySelector('#drawer-ai-assistant input[type=text]')?.disabled);
      console.log(`Response in ${((performance.now() - started) / 1000).toFixed(2)}s`);
      const frameGap = await page.evaluate(() => { const probe = window.modelFrameProbe; cancelAnimationFrame(probe.id); return probe.max; });
      console.log(`Longest UI frame: ${Math.round(frameGap)}ms`);
      assert.ok(frameGap < 2500, 'Inference must keep the browser UI responsive');
      const response = await page.locator('#drawer-ai-assistant .theme-surface.theme-text.theme-border.border.rounded-tl-xs').last().innerText();
      console.log('Assistant response:', response);
      assert.equal(await page.getByText(copy.unavailable, { exact: true }).count(), 0, await page.locator('#drawer-ai-assistant').innerText());
      return response;
    };
    const confirm = () => page.locator('[id^="btn-confirm-ai-event-"]').last();
    for (const greeting of language === 'pl' ? ['Cześć', 'Co?'] : ['Hello', 'What?']) {
      const before = performance.now();
      const reply = await send(greeting);
      assert.ok(performance.now() - before < 5000, 'Social messages must not wait for inference');
      assert.equal(inferenceMetrics.length, 0, 'Social messages must not invoke the model');
      assert.equal(await confirm().count(), 0);
      assert.equal((await records(page)).length, 0);
      assert.ok(!/nie znaleziono wydarzeń|no events found/i.test(reply));
    }
    await require('./model-device-check.cjs')(page, language);
    assert.equal((await records(page)).length, 0, 'Diagnostic inference must not write calendar events');
    await send(copy.create);
    assert.equal(await confirm().count(), 1, 'Create request must produce a reviewable proposal');
    assert.equal((await records(page)).length, 0, 'Inference must not write automatically');
    await confirm().click();
    await wait(async () => (await records(page)).length === 1);
    const original = (await records(page))[0];
    assert.equal(original.title, copy.title);
    assert.equal(original.startDate, '2026-10-22');
    assert.equal(original.startTime, '15:00');
    assert.equal(original.endDate, '2026-10-22');
    assert.equal(original.endTime, '16:00');
    await page.clock.setFixedTime(new Date('2026-10-21T08:02:00Z'));
    await send(copy.move);
    assert.equal(inferenceMetrics.length, 2, 'A simple move must use rules, independently of the changing minute');
    assert.equal(await confirm().count(), 1, 'Move request must produce a reviewable proposal');
    assert.equal((await records(page))[0].startDate, original.startDate);
    await confirm().click();
    await wait(async () => (await records(page))[0]?.startDate === '2026-10-24');
    assert.equal((await records(page))[0].startTime, '14:00');
    assert.equal((await records(page))[0].endTime, '15:00', 'Moving the start time must preserve the original duration');
    assert.equal((await records(page))[0].id, original.id);
    const found = await send(copy.search);
    await wait(async () => await page.locator('#btn-send-ai-message').isEnabled() === false && await page.locator('#drawer-ai-assistant input[type=text]').isEnabled());
    assert.equal(await confirm().count(), 0);
    assert.match(found, /2026-10-24/);
    assert.ok(found.includes(copy.title));
    await send(copy.remove);
    assert.equal(await page.getByRole('button', { name: copy.delete, exact: true }).count(), 1, 'Deletion requires a reviewable deletion proposal');
    assert.equal((await records(page)).length, 1);
    await page.getByRole('button', { name: copy.delete, exact: true }).click();
    await wait(async () => (await records(page)).length === 0);
    await page.locator('#btn-undo-ai').click();
    await wait(async () => (await records(page)).length === 1);
    const cases = language === 'pl' ? [
      { title: 'Trening', request: 'Dodaj wydarzenie Trening pojutrze o 18:30 do 19:30', date: '2026-10-23', time: '18:30', endDate: '2026-10-23', endTime: '19:30' },
      { title: 'Przegląd', request: 'Dodaj wydarzenie Przegląd w piątek o 09:15 do 10:15', date: '2026-10-23', time: '09:15', endDate: '2026-10-23', endTime: '10:15' },
      { title: 'Dyżur', request: 'Dodaj wydarzenie Dyżur 2026-10-31 o 23:30', date: '2026-10-31', time: '23:30', endDate: '2026-11-01', endTime: '00:30' },
      // Warsaw switches from summer to winter time on this date. Calendar days are not 24-hour offsets.
      { title: 'Kontrola', now: '2026-10-24T21:30:00Z', request: 'Dodaj wydarzenie Kontrola jutro o 09:00 do 10:00', date: '2026-10-25', time: '09:00', endDate: '2026-10-25', endTime: '10:00' },
    ] : [
      { title: 'Workout', request: 'Add event Workout the day after tomorrow at 18:30 until 19:30', date: '2026-10-23', time: '18:30', endDate: '2026-10-23', endTime: '19:30' },
      { title: 'Review', request: 'Add event Review on Friday at 09:15 until 10:15', date: '2026-10-23', time: '09:15', endDate: '2026-10-23', endTime: '10:15' },
      { title: 'Nightshift', request: 'Add event Nightshift on 2026-10-31 at 23:30', date: '2026-10-31', time: '23:30', endDate: '2026-11-01', endTime: '00:30' },
      { title: 'Checkup', now: '2026-10-24T21:30:00Z', request: 'Add event Checkup tomorrow at 09:00 until 10:00', date: '2026-10-25', time: '09:00', endDate: '2026-10-25', endTime: '10:00' },
    ];
    for (const example of cases) {
      await page.getByTitle(copy.clear, { exact: true }).click();
      await page.clock.setFixedTime(new Date(example.now || '2026-10-21T08:00:00Z'));
      const before = await records(page);
      await send(example.request);
      assert.equal(await confirm().count(), 1, 'A dated command must produce a proposal');
      assert.equal(await page.locator('#drawer-ai-assistant').getByText(copy.proposal, { exact: true }).count(), 1, 'Add commands must create a new event');
      assert.deepEqual(await records(page), before, 'A proposal must not change calendar records');
      await confirm().click();
      await wait(async () => (await records(page)).length === before.length + 1);
      const added = (await records(page)).find(event => !before.some(existing => existing.id === event.id));
      assert.equal(added.title, example.title);
      assert.deepEqual([added.startDate, added.startTime, added.endDate, added.endTime], [example.date, example.time, example.endDate, example.endTime]);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, [], 'Offline inference must not contact a remote service or CDN');
    if (process.env.MODEL_TEST_SCREENSHOT) await page.screenshot({ path: process.env.MODEL_TEST_SCREENSHOT, fullPage: true });
    console.log(`Real LFM2.5 offline ${language} create/edit/search/delete/undo, relative dates, weekday, midnight, DST and model persistence passed.`);
  } catch (error) {
    if (page && !page.isClosed()) console.error('Assistant state:', await page.locator('#drawer-ai-assistant').innerText().catch(() => 'unavailable'));
    throw error;
  } finally { await browser?.close(); server?.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
