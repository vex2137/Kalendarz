// Exercise the production drawer, optionally serving assets extracted from the APK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:4179';
const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.ASSISTANT_ROUTING_REPORT;
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host=127.0.0.1', '--port=4179', '--strictPort', '--outDir', process.env.ASSISTANT_TEST_WEB_DIR || 'dist'], { stdio: 'ignore' });
  let browser;
  const reports = [];
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launch({ headless: true, ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
    for (const uiLanguage of process.env.ASSISTANT_TEST_UI ? [process.env.ASSISTANT_TEST_UI] : ['en', 'pl', 'de', 'ru']) {
      const context = await browser.newContext({ timezoneId: 'Europe/Warsaw', serviceWorkers: 'block',
        ...(process.env.ASSISTANT_TEST_VIEWPORT === 'phone' ? { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true } : {}) });
      await context.addInitScript(language => localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language })), uiLanguage);
      const errors = [], external = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-23T08:00:00Z'));
      await page.goto(base);
      await page.locator('#btn-open-ai-assistant').click();
      await page.locator('[data-model-installed="true"]').waitFor();
      const drawer = page.locator('#drawer-ai-assistant');
      await drawer.locator('details summary').click();
      const report = async () => JSON.parse(await page.locator('#ai-diagnostics-report').textContent());
      assert.equal((await report()).build.commit, expectedCommit, 'Must run JS from the tested source commit');
      const input = drawer.locator('input[type=text]');
      const records = () => page.evaluate(async () => {
        const request = indexedDB.open('offline-calendar');
        const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
        try { return await new Promise(resolve => { const get = db.transaction('records').objectStore('records').getAll(); get.onsuccess = () => resolve(get.result); }); }
        finally { db.close(); }
      });
      const initialRecords = await records();
      const send = async (query, route, language, expectedText) => {
        const before = performance.now();
        const inputBox = await input.boundingBox();
        assert.ok(inputBox.y >= 0 && inputBox.y + inputBox.height <= page.viewportSize().height, 'Expanded diagnostics must keep the chat input visible');
        await input.fill(query);
        const filledMs = performance.now() - before;
        await page.locator('#btn-send-ai-message').click();
        const clickedMs = performance.now() - before;
        await page.waitForFunction(() => !document.querySelector('#drawer-ai-assistant input[type=text]').disabled);
        const data = await report();
        const reply = await drawer.locator('.rounded-tl-xs').last().innerText();
        const elapsedMs = performance.now() - before;
        reports.push({ uiLanguage, query, reply, elapsedMs, filledMs, clickedMs, inputBox, trace: data.lastTurn, lastModel: data.lastModel, session: data.session });
        if (output) fs.writeFileSync(output, JSON.stringify({ commit: expectedCommit, reports }, null, 2));
        console.log(JSON.stringify(reports.at(-1)));
        assert.equal(data.lastTurn.route, route, reply);
        assert.equal(data.lastTurn.language, language);
        assert.equal(data.lastTurn.uiLanguage, uiLanguage);
        assert.equal(data.lastTurn.quickChecked, true);
        assert.ok(Number.isFinite(data.lastTurn.uiCommitMs));
        assert.match(reply, expectedText);
        assert.doesNotMatch(reply, /Specify an unambiguous event title/u);
        if (route === 'quick') assert.ok(elapsedMs < 2000, `Greeting took ${elapsedMs} ms`);
      };
      await send('Cześć', 'quick', 'pl', /^Cześć!/u);
      await send('Cześć'.normalize('NFD'), 'quick', 'pl', /^Cześć!/u);
      await send('Cześć\u200b!', 'quick', 'pl', /^Cześć!/u);
      await send('Dodaj wydarzenie Kontrola jutro o 15:00', 'rules', 'pl', /^Sprawdź/u);
      await send('Add event Checkup tomorrow at 15:00', 'rules', 'en', /^Review/u);
      await send('Привет', 'quick', 'ru', /^Привет!/u);
      await send('Hallo', 'quick', 'de', /^Hallo!/u);
      if (uiLanguage === 'en' && process.env.ASSISTANT_TEST_MODEL === '1') {
        await send('Dodaj wydarzenie Pomiar jutro o 14:15 z opisem spokojna wizyta', 'model', 'pl', /^Sprawdź/u);
        const metric = (await report()).lastModel;
        assert.ok(metric.promptTokens > 0 && metric.completionTokens > 0 && Number.isFinite(metric.promptMs), 'Real offline GGUF timings required');
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      assert.deepEqual(await records(), initialRecords, 'No message may save an event without confirmation');
      await context.close();
    }
    if (output) fs.writeFileSync(output, JSON.stringify({ commit: expectedCommit, reports }, null, 2));
    console.log(`Production drawer routing passed: ${reports.length} messages across all four UI languages.`);
    console.log(JSON.stringify(reports.map(r => ({ ui: r.uiLanguage, route: r.trace.route, language: r.trace.language, elapsedMs: Math.round(r.elapsedMs), uiCommitMs: r.trace.uiCommitMs }))));
  } finally { await browser?.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
