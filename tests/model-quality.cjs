// Public bilingual fixtures only. This executes native WASM; it never writes events.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { existsSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const base = 'http://127.0.0.1:4186';
const modelId = process.env.CANDIDATE_MODEL_ID || 'lfm2.5-350m-q4-k-m';
const preset = process.env.QUALITY_PRESET || 'smoke';
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host=127.0.0.1', '--port=4186', '--strictPort'], { stdio: 'ignore' });
  const profile = mkdtempSync(join(tmpdir(), 'calendar-quality-'));
  let browser;
  const results = { modelId, preset, platform: 'cloud-chromium', physicalDevice: false, externalRequests: [], runs: [] };
  const save = () => writeFileSync('quality-results.json', JSON.stringify(results, null, 2));
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launchPersistentContext(profile, { headless: true, serviceWorkers: 'block', ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
    await browser.route('**/*', route => { if (new URL(route.request().url()).origin !== base) { results.externalRequests.push(route.request().url()); return route.abort(); } return route.continue(); });
    const page = await browser.newPage();
    page.setDefaultTimeout(21_000_000);
    await page.exposeFunction('qualityCheckpoint', run => { const index = results.runs.findIndex(row => row.id === run.id); if (index < 0) results.runs.push(run); else results.runs[index] = run; save(); });
    await page.goto(base + '/tests/model-evaluation.html');
    await page.waitForFunction(() => window.calendarEvaluation);
    await page.evaluate(async id => {
      const { runtime } = window.calendarEvaluation;
      await runtime.selectLocalModel(id);
      if (id !== 'lfm2.5-350m-q4-k-m') await runtime.installLocalModel(await (await fetch('/benchmark-model.gguf')).blob());
      await runtime.checkLocalModel();
      if (!runtime.modelStatus().installed) throw new Error('quality-model-not-installed');
    }, modelId);
    for (const mode of ['rules', 'llm', 'assistant']) {
      const summary = await page.evaluate(async ({ mode, preset }) => {
        const { benchmarks } = window.calendarEvaluation;
        const controller = new AbortController();
        const limit = setTimeout(() => controller.abort(), preset === 'corpus' ? 90 * 60_000 : 25 * 60_000);
        try {
          const run = await benchmarks.runAssistantBenchmark({ mode, preset, signal: controller.signal, onProgress: run => { void window.qualityCheckpoint(run); } });
          await window.qualityCheckpoint(run);
          return { mode, status: run.status, ...benchmarks.summarizeBenchmarkRun(run) };
        } finally { clearTimeout(limit); }
      }, { mode, preset });
      console.log('QUALITY_SUMMARY', JSON.stringify({ modelId, preset, ...summary }));
    }
    if (results.externalRequests.length) throw new Error('unexpected-external-request');
  } catch (error) { results.error = String(error); process.exitCode = 1; }
  finally { save(); await browser?.close(); server.kill('SIGTERM'); rmSync(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
