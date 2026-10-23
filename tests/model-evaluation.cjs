// Real GGUF evaluation. Fixture expectations are shared by baseline and optimized runs.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const fixture = JSON.parse(fs.readFileSync(__dirname + '/fixtures/assistant-evaluation.json'));
const base = process.env.EVALUATION_URL || 'http://127.0.0.1:4181';
const output = process.env.EVALUATION_OUTPUT;
assert.ok(output, 'Set EVALUATION_OUTPUT');
const results = { fixtureSha256: createHash('sha256').update(fs.readFileSync(__dirname + '/fixtures/assistant-evaluation.json')).digest('hex'), requestedThreads: process.env.EVALUATION_THREADS ? Number(process.env.EVALUATION_THREADS) : 'auto', raw: process.env.EVALUATION_RAW === '1', cases: [], errors: [], external: [] };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const language of (process.env.EVALUATION_LANGUAGE || 'pl,en').split(',')) {
      const context = await browser.newContext({ timezoneId: 'Europe/Warsaw' });
      if (process.env.EVALUATION_THREADS) await context.addInitScript(threads => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => threads }), Number(process.env.EVALUATION_THREADS));
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : (results.external.push(route.request().url()), route.abort()));
      const page = await context.newPage();
      page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
      page.on('pageerror', error => results.errors.push(error.message));
      await page.goto(base + '/tests/model-evaluation.html');
      await page.waitForFunction(() => window.calendarEvaluation);
      for (const item of fixture) {
        if (process.env.EVALUATION_IDS && !process.env.EVALUATION_IDS.split(',').includes(item.id)) continue;
        const actual = await page.evaluate(async ({ item, language, raw }) => {
          const { runModelAssistant, DEFAULT_PLANNING, runtime, calendarSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } = window.calendarEvaluation;
          const now = new Date('2026-10-23T08:00:00Z');
          const events = item.events || [
            { id: 'dentist', title: 'Dentysta', startDate: '2026-10-26', endDate: '2026-10-26', startTime: '15:00', endTime: '16:30', allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1 },
            { id: 'yoga', title: 'Joga', startDate: '2026-10-27', endDate: '2026-10-27', startTime: '18:00', endTime: '19:00', allDay: false, color: 'peacock', recurrence: 'NONE', reminders: [], createdAt: 1, updatedAt: 1 },
          ];
          const start = performance.now();
          let context = {}, result, inferenceCount = 0, metrics;
          const info = console.info;
          console.info = (...args) => { if (args[0] === 'Local model performance:') { inferenceCount++; metrics = JSON.parse(args[1]); } info(...args); };
          try {
            for (const query of item[language]) {
              if (raw) {
                const json = await runtime.inferCalendarJson(calendarSystemPrompt(language, now), 'Current request:\n' + query, commandSchemaForRequest(query));
                result = await resolveModelCommand(parseModelCommand(json), query, events, language, now, DEFAULT_PLANNING);
              } else { result = await runModelAssistant(query, events, language, now, context, DEFAULT_PLANNING); context = result.context; }
            }
            return { ms: performance.now() - start, plan: result.suggestedPlan, text: result.text, route: result.route, inferenceCount, metrics };
          } catch (error) { return { ms: performance.now() - start, error: error.message, inferenceCount, metrics }; }
          finally { console.info = info; }
        }, { item, language, raw: process.env.EVALUATION_RAW === '1' });
        let passed = !actual.error;
        const expected = item.expected;
        if (expected.kind) {
          passed &&= actual.plan?.kind === expected.kind;
          const event = actual.plan?.events?.[0];
          for (const [key, value] of Object.entries(expected.event || {})) passed &&= event?.[key] === value;
          if (expected.id) passed &&= actual.plan?.originals?.[0]?.id === expected.id;
          passed &&= actual.plan?.events?.length === 1;
        } else {
          passed &&= !actual.plan;
          for (const text of expected.contains || []) passed &&= actual.text?.toLowerCase().includes(text.toLowerCase());
          if (expected.clarify) passed &&= /podaj|doprecyz|któ|któr|o której|specify|clarif|which|what time|please provide/i.test(actual.text || '');
        }
        const row = { id: item.id, language, passed, expected, ...actual };
        results.cases.push(row); fs.writeFileSync(output, JSON.stringify(results, null, 2));
        console.log(JSON.stringify({ id: item.id, language, passed, ms: Math.round(actual.ms), inference: actual.inferenceCount, error: actual.error }));
      }
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(results.external, []); assert.deepEqual(results.errors, []);
  console.log('SUMMARY', JSON.stringify(['pl', 'en'].map(language => { const rows = results.cases.filter(r => r.language === language); return { language, count: rows.length, passed: rows.filter(r => r.passed).length, meanMs: rows.reduce((n, r) => n + r.ms, 0) / rows.length }; })));
})().catch(error => { console.error(error); process.exitCode = 1; });
