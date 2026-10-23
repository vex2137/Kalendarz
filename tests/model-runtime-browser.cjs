// Actual GGUF, initialization sharing, offline execution, native timings and lifecycle.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.EVALUATION_URL || 'http://127.0.0.1:4181';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ timezoneId: 'Europe/Warsaw' });
    if (process.env.EVALUATION_THREADS) await context.addInitScript(n => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }), Number(process.env.EVALUATION_THREADS));
    const external = [], errors = [];
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
      if (process.env.EVALUATION_ISOLATION === '0' && route.request().isNavigationRequest()) {
        const response = await route.fetch(); const headers = response.headers();
        delete headers['cross-origin-opener-policy']; delete headers['cross-origin-embedder-policy'];
        return route.fulfill({ response, headers });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', m => { if (m.text().startsWith('Local model performance:') || m.type() === 'error') console.log(m.text()); });
    await page.goto(base + '/tests/model-evaluation.html');
    await page.waitForFunction(() => window.calendarEvaluation);
    const measured = await page.evaluate(async () => {
      const { runtime, runModelAssistant, DEFAULT_PLANNING, COMMAND_SCHEMA, calendarSystemPrompt } = window.calendarEvaluation;
      await runtime.checkLocalModel();
      let last = performance.now(), frameMaxMs = 0, frameId;
      const tick = at => { frameMaxMs = Math.max(frameMaxMs, at - last); last = at; frameId = requestAnimationFrame(tick); };
      frameId = requestAnimationFrame(tick);
      runtime.setAssistantActive(true);
      const preload = runtime.prepareLocalModel();
      const before = performance.now();
      const quick = await runModelAssistant('Cześć', [], 'pl', new Date(), {}, DEFAULT_PLANNING);
      const quickMs = performance.now() - before;
      const schema = { type: 'object', additionalProperties: false, properties: { action: { const: 'create' }, title: { type: 'string' } }, required: ['action', 'title'] };
      // Join the same initialization, never return model-busy because of preload.
      const first = runtime.inferCalendarJson('Extract a JSON calendar command.', 'Add event Measurement tomorrow at 14:15', schema, [], { maxTokens: 64 });
      let busyRejected = false;
      try { await runtime.inferCalendarJson('test', 'test', schema); } catch (error) { busyRejected = error.message === 'model-busy'; }
      const cold = await first; await preload;
      const warm = await runtime.inferCalendarJson('Extract a JSON calendar command.', 'Add event Measurement tomorrow at 14:15', schema, [], { maxTokens: 64 });
      cancelAnimationFrame(frameId);
      const inflight = runtime.inferCalendarJson('Extract a JSON calendar command.', 'Add event Cancellation check tomorrow at 16:15', schema, [], { maxTokens: 64 });
      await new Promise(resolve => setTimeout(resolve, 50));
      window.dispatchEvent(new Event('calendar-memory-pressure'));
      let cancelled = false;
      try { await inflight; } catch (error) { cancelled = error.message === 'model-cancelled'; }
      return { cold: JSON.parse(cold), warm: JSON.parse(warm), busyRejected, cancelled, quickMs, quickRoute: quick.route, frameMaxMs };
    });
    await page.waitForFunction(() => window.calendarEvaluation.runtime.modelStatus().phase === 'installed');
    assert.equal(measured.cold.action, 'create'); assert.equal(measured.warm.action, 'create');
    assert.equal(measured.busyRejected, true); assert.equal(measured.quickRoute, 'quick'); assert.ok(measured.quickMs < 1000);
    assert.equal(measured.cancelled, true, 'Memory pressure must cancel an active request safely');
    assert.ok(measured.frameMaxMs < 1500, 'The main UI must stay responsive during real initialization and inference');
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    // Close/hidden policy uses main-thread timers; worker disposal is still real.
    await page.clock.install();
    await page.evaluate(async () => { const r = window.calendarEvaluation.runtime; await r.prepareLocalModel(); r.setAssistantActive(false); });
    await page.clock.fastForward(30_001);
    await page.waitForFunction(() => window.calendarEvaluation.runtime.modelStatus().phase === 'installed');
    const report = { ...measured, external, errors, diagnostics: await page.evaluate(() => window.calendarEvaluation.diagnosticsReport()) };
    const inferences = report.diagnostics.metrics.filter(m => m.route === 'model' && !m.error);
    assert.equal(inferences.length, 2);
    for (const metric of inferences) for (const key of ['promptMs', 'generationMs', 'tokensPerSecond', 'promptTokens', 'cachedTokens', 'completionTokens']) assert.ok(Number.isFinite(metric[key]), `${key} must come from actual native timings`);
    if (process.env.EVALUATION_ISOLATION === '0') {
      assert.equal(report.diagnostics.capabilities.isolated, false);
      assert.ok(inferences.every(metric => metric.threads === 1 && !metric.multithread));
    }
    fs.writeFileSync(process.env.RUNTIME_OUTPUT || '/workspace/artifacts/model-runtime.json', JSON.stringify(report, null, 2));
    console.log('Real preload/join, busy guard, quick routing, cold/warm inference, memory pressure and idle release passed', JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
