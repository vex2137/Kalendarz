// Production runtime + real React navigation and OPFS/HTTP. The small synthetic
// catalogue fixture tests transfer integrity, never model inference or GPU support.
// The separate native boundary scenario uses durable Node-owned service state;
// it does not establish Android foreground-service/notification behavior.
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright');

const base = 'http://127.0.0.1:4196';
const id = require('../src/utils/optionalModels.json')[0].id;
const payload = Buffer.alloc(16 * 1024 * 1024);
for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
payload.write('GGUF');
const sha256 = crypto.createHash('sha256').update(payload).digest('hex');
const requests = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function prepare(page, url) {
  await page.evaluate(async fixture => {
    const registry = await import('/src/utils/modelRegistry.ts');
    // Mutate only a trusted test catalogue descriptor, never register an invented
    // public hash or alter the application's shipped catalogue on disk.
    const model = registry.findModel(fixture.id);
    Object.assign(model, {url:fixture.url,bytes:fixture.bytes,sha256:fixture.sha256});
    window.lifecycleModel = model;
    window.lifecycleRuntime = await import('/src/utils/localModelRuntime.ts');
    await window.lifecycleRuntime.selectLocalModel(model.id);
  }, {id,url,bytes:payload.length,sha256});
}
async function openModels(page) {
  await page.locator('#btn-open-ai-assistant').click();
  await page.locator('#btn-ai-settings').click();
  await page.locator(`[data-model-id="${id}"]`).waitFor();
}
async function leaveModels(page) {
  await page.locator('#ai-settings-panel header button').click();
  await page.locator('#btn-close-ai-drawer').click();
  await page.locator('#drawer-ai-assistant').waitFor({state:'detached'});
  await page.locator('#btn-open-settings').click();
  await page.locator('#btn-close-settings-modal').click();
  await page.locator('#modal-settings').waitFor({state:'detached'});
}

(async () => {
  const transfers = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range');
    res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Range, Content-Length');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const offset = Number((req.headers.range || '').match(/^bytes=(\d+)-$/)?.[1] || 0);
    requests.push({range:req.headers.range,validator:req.headers['if-range'],offset});
    res.statusCode = offset ? 206 : 200;
    res.setHeader('ETag', '"lifecycle-v1"');
    res.setHeader('Content-Length', payload.length - offset);
    if (offset) res.setHeader('Content-Range', `bytes ${offset}-${payload.length - 1}/${payload.length}`);
    let sent = offset;
    const timer = setInterval(() => {
      // Keep the first request in flight until the UI explicitly pauses it;
      // machine/animation speed cannot turn this into a post-completion click.
      if (!offset && sent >= 8 * 1024 * 1024) return;
      const end = Math.min(sent + 64 * 1024, payload.length);
      res.write(payload.subarray(sent, end)); sent = end;
      if (sent === payload.length) { clearInterval(timer); res.end(); }
    }, 35);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise(resolve => transfers.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${transfers.address().port}/lifecycle.gguf`;
  const vite = spawn(process.execPath, ['--input-type=module','--eval',"import {createServer} from 'vite'; const server = await createServer({cacheDir:'node_modules/.vite-transfer-lifecycle',server:{host:'127.0.0.1',port:4196,strictPort:true}}); await server.listen();"], {
    stdio:['ignore','pipe','pipe'], env:{...process.env,DISABLE_HMR:'true'},
  });
  let viteOutput = '';
  for (const stream of [vite.stdout,vite.stderr]) stream.on('data', chunk => { viteOutput = (viteOutput + chunk).slice(-5000); });
  let browser, nativeTimer;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
      await sleep(100);
    }
    assert.ok(ready, 'dedicated Vite server did not become ready');
    const executablePath = process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {}),args:['--no-sandbox']});
    const context = await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await prepare(page, url); await openModels(page);
    const row = page.locator(`[data-model-id="${id}"]`);
    await row.getByRole('button', {name:'Download',exact:true}).click();
    await page.waitForFunction(() => window.lifecycleRuntime.modelStatus().transfer?.receivedBytes >= 1024 * 1024);
    const first = await page.evaluate(() => window.lifecycleRuntime.modelStatus().transfer.receivedBytes);
    await page.locator('#ai-settings-panel header button').click();
    await page.waitForFunction(() => !document.querySelector('#drawer-ai-assistant input[type=text]').disabled);
    // Hold history persistence so the chat's cancellation control remains visible
    // while an unrelated model transfer owns the runtime operation.
    await page.evaluate(async () => {
      const request = indexedDB.open('calendar-ai-chats');
      const db = await new Promise((resolve, reject) => {request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const tx = db.transaction(['chats','messages'], 'readwrite');
      window.releaseHistoryLock = false;
      const hold = () => {const get=tx.objectStore('chats').get('lock');get.onsuccess=()=>{if(!window.releaseHistoryLock)hold();};};
      tx.oncomplete=()=>db.close();hold();
    });
    await page.locator('#drawer-ai-assistant input[type=text]').fill('Hello');
    await page.locator('#btn-send-ai-message').click();
    await page.locator('#btn-stop-ai-generation').click();
    assert.equal(await page.evaluate(() => window.lifecycleRuntime.modelStatus().phase), 'downloading', 'Chat cancellation must not pause a model download');
    await page.evaluate(() => {window.releaseHistoryLock=true;});
    await page.waitForFunction(() => !document.querySelector('#drawer-ai-assistant input[type=text]').disabled);
    await page.locator('#btn-ai-settings').click();
    await leaveModels(page); // settings -> chat -> calendar -> calendar settings
    await page.evaluate(async () => {
      window.lifecycleRuntime.setAssistantActive(false);
      Object.defineProperty(document, 'hidden', {configurable:true,get:() => true});
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('calendar-memory-pressure'));
      window.dispatchEvent(new Event('pagehide'));
      await window.lifecycleRuntime.unloadLocalModel();
    });
    await page.waitForFunction(before => window.lifecycleRuntime.modelStatus().transfer?.receivedBytes > before + 1024 * 1024, first);
    assert.equal(await page.evaluate(() => window.lifecycleRuntime.modelStatus().phase), 'downloading');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable:true,get:() => false});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await openModels(page);
    await page.locator('[data-testid="local-model-setup"] progress').waitFor();
    const displayed = Number(await page.locator('[data-testid="local-model-setup"] progress').getAttribute('value'));
    assert.ok(displayed > first / payload.length * 100, 'returning model UI must show current progress');
    assert.equal(requests.length, 1, 'navigation must keep the original HTTP request running');

    // Only an explicit transfer cancellation pauses. Its durable checkpoint must
    // survive a real document reload and authorize an ETag-protected HTTP Range.
    await page.getByRole('button', {name:'Stop',exact:true}).click();
    await page.waitForFunction(() => window.lifecycleRuntime.modelStatus().phase === 'missing');
    const checkpoint = await page.evaluate(() => window.lifecycleRuntime.modelStatus().resumeBytes);
    assert.ok(checkpoint > 0 && checkpoint < payload.length, `invalid checkpoint ${checkpoint}`);
    assert.equal(await row.getAttribute('data-model-installation'), 'partial');
    await row.getByRole('button', {name:'Resume download',exact:true}).waitFor();
    await page.reload(); await prepare(page, url); await openModels(page);
    await row.getByRole('button', {name:'Resume download',exact:true}).click();
    await page.waitForFunction(() => window.lifecycleRuntime.modelStatus().installed === true);
    const installed = await page.evaluate(async () => {
      const store = await import('/src/utils/localModelStore.ts');
      const transfer = await import('/src/utils/resumableModelTransfer.ts');
      const saved = await store.savedModel(window.lifecycleModel);
      await store.verifyModel(saved, undefined, undefined, window.lifecycleModel);
      await window.lifecycleRuntime.unloadLocalModel();
      return {bytes:saved.size,status:window.lifecycleRuntime.modelStatus(),remaining:await transfer.modelTransferBytes(window.lifecycleModel)};
    });
    assert.equal(installed.bytes, payload.length); assert.equal(installed.remaining, 0);
    assert.equal(installed.status.installation, 'verified'); assert.equal(installed.status.loaded, false);
    assert.ok(requests.some(request => request.offset === checkpoint && request.validator === '"lifecycle-v1"'), 'resume must use exact checkpoint + If-Range');
    assert.equal(await row.getAttribute('data-model-installation'), 'verified');
    assert.equal(await row.getByTestId('model-in-use').count(), 0, 'installed bytes do not imply loaded inference');
    assert.deepEqual(errors, []); await context.close();
    console.log('PASS: real HTTP + OPFS transfer survives model/chat/calendar/settings navigation, hidden/memory/pagehide/unload, exposes current telemetry, and explicitly pauses/resumes through verified commit');

    // Native bridge boundary: service state lives outside the document, like a
    // real service. This intentionally stubs native bytes/verification only.
    let state = {modelId:id,phase:'missing',receivedBytes:0,totalBytes:payload.length,resumeBytes:0,installed:false,verified:false,bytesPerSecond:128 * 1024 / 0.05,etaSeconds:7};
    let starts = 0, pauses = 0, statusReads = 0;
    const native = await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
    await native.exposeBinding('__lifecycleService', async (_source, method, options) => {
      if (options?.model?.id && options.model.id !== id) return {modelId:options.model.id,phase:'missing',receivedBytes:0,totalBytes:options.model.bytes,resumeBytes:0,installed:false,verified:false};
      if (method === 'status') { statusReads++; return {...state}; }
      if (method === 'start') { starts++; state.phase = 'downloading'; return {...state}; }
      if (method === 'pause') { pauses++; state.phase = 'paused'; state.resumeBytes = state.receivedBytes; return {...state}; }
      if (method === 'info') return {installed:state.installed,verified:state.verified,bytes:state.installed ? payload.length : 0};
      if (method === 'seedBegin') return {exists:true};
      throw Error(`Unexpected native boundary method: ${method}`);
    });
    nativeTimer = setInterval(() => {
      if (state.phase !== 'downloading') return;
      state.receivedBytes = Math.min(payload.length, state.receivedBytes + 128 * 1024);
      state.resumeBytes = state.receivedBytes;
      state.etaSeconds = (payload.length - state.receivedBytes) / state.bytesPerSecond;
      if (state.receivedBytes === payload.length) Object.assign(state, {phase:'installed',installed:true,verified:true,resumeBytes:0});
    }, 50);
    await native.addInitScript(() => {
      window.androidBridge = {};
      window.Capacitor = {
        PluginHeaders:[
          {name:'CalendarModelTransfer',methods:['start','status','pause','seedBegin','seedWrite','seedFinish','seedAbort'].map(name => ({name,rtype:'promise'}))},
          {name:'CalendarDevice',methods:['setLanguage','setSystemBarColors','notificationStatus','removeListener'].map(name => ({name,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'}])},
          {name:'LocalNotifications',methods:['checkPermissions','requestPermissions','getPending','cancel','schedule'].map(name => ({name,rtype:'promise'}))},
        ],
        nativePromise: async (plugin, method, options) => {
          if (plugin === 'CalendarModelTransfer') return window.__lifecycleService(method, options);
          if (method === 'notificationStatus') return {enabled:true,channel:'ready'};
          if (method === 'checkPermissions' || method === 'requestPermissions') return {display:'granted'};
          if (method === 'getPending') return {notifications:[]};
          return {};
        },
        nativeCallback: () => Promise.resolve('listener'),
      };
      window.calendarNativeAI = {platform:'android',info:modelId => window.__lifecycleService('info',{model:{id:modelId}}),stop:async () => {},
        status:async () => ({backend:'cpu-native',mode:'auto',available:true,loaded:false,gpuActive:false}),
        prepare:async () => { throw Error('fixture has no inference engine'); }};
    });
    const nativePage = await native.newPage(); nativePage.setDefaultTimeout(30000);
    await nativePage.goto(base); await prepare(nativePage, url); await openModels(nativePage);
    await nativePage.locator(`[data-model-id="${id}"]`).getByRole('button', {name:'Download',exact:true}).click();
    await nativePage.waitForFunction(() => window.lifecycleRuntime.modelStatus().transfer?.receivedBytes > 0);
    assert.equal(starts, 1);
    await leaveModels(nativePage);
    assert.equal(pauses, 0, 'navigation must not pause a native service');
    await nativePage.reload();
    const readsBeforeJoin = statusReads;
    await prepare(nativePage, url); await openModels(nativePage);
    await nativePage.waitForFunction(() => window.lifecycleRuntime.modelStatus().transfer?.receivedBytes > 0);
    assert.ok(statusReads > readsBeforeJoin); assert.equal(starts, 1, 'recreated WebView joins the existing service without a second start');
    await nativePage.getByRole('button', {name:'Stop',exact:true}).click();
    await nativePage.waitForFunction(() => window.lifecycleRuntime.modelStatus().phase === 'missing');
    assert.equal(pauses, 1); assert.equal(state.phase, 'paused');
    const nativeCheckpoint = state.resumeBytes; assert.ok(nativeCheckpoint > 0);
    await nativePage.locator(`[data-model-id="${id}"]`).getByRole('button', {name:'Resume download',exact:true}).click();
    await nativePage.waitForFunction(() => window.lifecycleRuntime.modelStatus().installed === true);
    assert.equal(starts, 2); assert.equal(pauses, 1); assert.equal(state.verified, true);
    await native.close(); clearInterval(nativeTimer); nativeTimer = undefined;
    console.log('PASS: native-bridge simulation keeps a service across navigation/reload, joins real service telemetry without duplicate start, and explicitly pauses/resumes');
  } catch (error) {
    console.error(viteOutput); throw error;
  } finally {
    clearInterval(nativeTimer); await browser?.close(); vite.kill('SIGTERM');
    transfers.closeAllConnections(); await new Promise(resolve => transfers.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
