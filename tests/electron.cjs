const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { _electron } = require('playwright');
(async () => {
  const profile = mkdtempSync(join(tmpdir(), 'kalendarz-desktop-'));
  let application;
  try {
    application = await _electron.launch({
      executablePath:
        process.env.ELECTRON_EXECUTABLE ||
        resolve(
          process.platform === 'win32'
            ? 'release/win-unpacked/Calendar.exe'
            : 'release/linux-unpacked/calendar',
        ),
      env: {
        ...process.env,
        XDG_CACHE_HOME: join(profile, 'cache'),
        XDG_CONFIG_HOME: join(profile, 'config'),
      },
      args: [
        '--no-sandbox',
        '--disable-gpu',
        `--user-data-dir=${join(profile, 'data')}`,
      ],
      timeout: 20000,
    });
    assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), join(profile, 'data'));
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    assert.equal(
      await application.evaluate(({ app }) => app.getVersion()),
      require('../package.json').version,
    );
    await page.locator('#btn-create-event-top').waitFor();
    await page.locator('#btn-create-event-top').click();
    await page.locator('#input-event-title').fill('Desktop smoke event');
    await page.locator('#btn-save-event-form').click();
    await page.getByText('Desktop smoke event', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Desktop smoke event', { exact: true }).waitFor();
    // Exercise the actual file-origin Web Crypto and worker paths in packaged CI.
    const before = await page.getByTestId('calendar-navigation').getAttribute('data-date-key');
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.getByTestId('calendar-navigation').getAttribute('data-date-key'), before);
    await page.keyboard.press('ArrowLeft');
    await page.locator('#btn-open-sync').click();
    await page.getByLabel('Sync password', { exact: true }).fill('Desktop encrypted sync password');
    await page.getByRole('button', { name: 'Generate encrypted code', exact: true }).click();
    await page.getByAltText('Sync QR', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Sync password', { exact: true }).inputValue(), '');
    await page.keyboard.press('Escape');
    const external = [];
    await page.context().route(/^https?:\/\//, route => {
      external.push(route.request().url());
      return route.abort();
    });
    await page.locator('#btn-open-ai-assistant').click();
    // Model-free distributions must exercise real model installation rather
    // than skip the inference assertions or pretend weights are bundled.
    if(process.env.CALENDAR_EXTERNAL_MODEL){
      const directory=require('node:path').dirname(require('node:fs').realpathSync(process.env.CALENDAR_EXTERNAL_MODEL));
      await page.locator('#btn-ai-settings').click();
      await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').click();
      await page.locator('[data-testid=backend-mode-result]:visible').filter({hasText:'Mode saved'}).waitFor();
      await application.evaluate(({dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});},directory);
      const folders=page.getByTestId('model-folders');await folders.getByRole('button',{name:'Add folder',exact:true}).click();
      await folders.locator('[data-external-model-id]').first().getByRole('button',{name:'Use model',exact:true}).click();
      await page.locator('#ai-settings-panel header button').click();
    }
    const modelMetrics=await require('./model-device-check.cjs')(page, 'en');
    for(const metric of modelMetrics)assert.ok(['cpu-native','vulkan'].includes(metric.backend),'Packaged desktop must execute the native runtime');
    assert.equal(await page.evaluate(()=>typeof window.calendarNativeAI?.status),'function','The trusted renderer must have the native bridge');
    const isolation=await application.evaluate(({BrowserWindow})=>{const prefs=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {sandbox:prefs.sandbox,contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration};});
    assert.deepEqual(isolation,{sandbox:true,contextIsolation:true,nodeIntegration:false});
    assert.equal(await page.evaluate(()=>typeof require),'undefined');
    assert.equal(await application.evaluate(async({BrowserWindow,app})=>{
      const trusted=BrowserWindow.getAllWindows()[0].webContents;
      const preload=app.getAppPath()+'/electron/preload.cjs';
      const untrusted=new BrowserWindow({show:false,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false}});
      // Electron 44 omits preload from getLastWebPreferences(). Use the
      // packaged path and require a real bridge before testing sender rejection.
      try{await untrusted.loadURL(trusted.getURL());return await untrusted.webContents.executeJavaScript("typeof window.calendarNativeAI?.status==='function' && window.calendarNativeAI.status().then(()=>false,()=>true)");}finally{untrusted.destroy();}
    }),true,'Another renderer must not access the inference bridge');
    await page.locator('#btn-ai-settings').click();
    await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').click();
    await page.locator('[data-testid=backend-mode-result]:visible').filter({hasText:'Mode saved'}).waitFor();
    await page.waitForFunction(()=>localStorage.getItem('calendar_ai_backend_mode_v1')==='cpu');
    assert.equal(await page.locator('[data-testid=backend-settings]:visible [data-backend]').getAttribute('data-gpu-active'),'false');
    await page.reload();await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
    assert.equal(await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').getAttribute('aria-pressed'),'true');
    await page.locator('#ai-settings-panel header button').click();
    const started = performance.now();
    await page.locator('#drawer-ai-assistant input[type=text]').fill('Add event Desktopcheck on 2026-11-15 at 15:00 until 16:00');
    await page.locator('#btn-send-ai-message').click();
    await page.locator('[id^="btn-confirm-ai-event-"]').waitFor({ timeout: 180000 });
    const proposal = await page.locator('#drawer-ai-assistant').innerText();
    assert.match(proposal, /Desktopcheck/);
    assert.match(proposal, /2026-11-15 15:00/);
    assert.match(proposal, /16:00/);
    assert.deepEqual(external, []);
    console.log(`PASS actual packaged GGUF probe and reviewed rule proposal with HTTP blocked; rule response: ${((performance.now() - started) / 1000).toFixed(2)}s`);
    assert.deepEqual(errors, []);
    console.log(
      'PASS packaged Electron: file-origin startup, IndexedDB persistence, keyboard navigation and encrypted QR generation',
    );
  } finally {
    await application?.close();
    rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
