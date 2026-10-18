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
        resolve('release/linux-unpacked/kalendarz-offline'),
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
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.locator('#btn-create-event-top').waitFor();
    await page.locator('#btn-create-event-top').click();
    await page.locator('#input-event-title').fill('Desktop smoke event');
    await page.locator('#btn-save-event-form').click();
    await page.getByText('Desktop smoke event', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Desktop smoke event', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS packaged Electron: file-origin startup, lazy form, IndexedDB save and reload',
    );
  } finally {
    await application?.close();
    rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
