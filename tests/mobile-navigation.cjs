const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync } = require('node:fs');
const base = process.env.CALENDAR_TEST_URL || 'http://127.0.0.1:4176';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  try {
    for (const language of ['en', 'pl', 'ru', 'de']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(lang => {
        localStorage.setItem('offline_calendar_events_v2', '[]');
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ language: lang, theme: 'dark' }));
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.locator('#btn-open-settings').waitFor();
      const label = { en: 'Calendar views', pl: 'Widoki kalendarza', ru: 'Виды календаря', de: 'Kalenderansichten' }[language];
      for (const width of [320, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const nav = page.getByRole('navigation', { name: label, exact: true });
        assert.equal(await nav.count(), 1, `duplicate view navigation at ${width}px (${language})`);
        assert.equal(await nav.getByRole('button').count(), 5);
        assert.equal(await page.locator('nav.sm\\:hidden').isVisible(), width < 640);
        for (const button of await nav.getByRole('button').all()) {
          await button.click();
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}px`);
        if (width < 640) assert.ok((await page.locator('header').boundingBox()).height <= 130, 'mobile header is unnecessarily tall');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('navigation', { name: label }).getByRole('button').nth(1).click();
      const colors = await page.locator('#btn-open-ai-assistant, #btn-open-sync, #btn-open-settings').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color));
      assert.equal(new Set(colors).size, 3, 'assistant, sync and settings must have distinct colors');
      for (const id of ['btn-open-search', 'btn-open-ai-assistant', 'btn-open-sync', 'btn-open-settings', 'btn-open-download']) {
        await page.locator(`#${id}`).click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'detached' });
      }
      assert.deepEqual(errors, []);
      if (language === 'en' && process.env.CALENDAR_SCREENSHOT) await page.screenshot({ path: process.env.CALENDAR_SCREENSHOT });
      await context.close();
    }
    console.log('PASS: one visible view selector at 320/390/430/768/1280px, all views work, colored actions open correctly, PL/EN/RU/DE, no horizontal overflow or browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
