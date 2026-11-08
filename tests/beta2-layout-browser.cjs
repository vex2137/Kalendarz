const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
  try {
    for (const size of [{width: 320, height: 800}, {width: 390, height: 844}, {width: 844, height: 390}]) {
      const context = await browser.newContext({ viewport: size, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.goto(process.env.CALENDAR_TEST_URL || 'http://127.0.0.1:4176');
      const nav = page.getByRole('navigation', {name: 'Calendar views', exact: true});
      for (const [index, expected] of [[3, 0], [2, 7]]) {
        await nav.getByRole('button').nth(index).click();
        await page.getByTestId('time-view').waitFor();
        assert.equal(await page.locator('.timeline-date').count(), expected);
        assert.equal(await page.locator('.timeline-all-day-row').count(), 1);
        assert.ok(await page.locator('.timeline-hour').count() >= 24);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await nav.getByRole('button').nth(1).click();
      assert.equal(await page.locator('.month-view').count(), 1);
      await context.close();
    }
    console.log('PASS: compact day, seven week headings, timeline and month at narrow and landscape sizes');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
