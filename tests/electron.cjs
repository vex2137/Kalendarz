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
