const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  try {
    for (const language of ['en', 'pl']) for (const size of [{width: 320, height: 800}, {width: 390, height: 844}, {width: 844, height: 390}]) {
      const context = await browser.newContext({viewport: size, serviceWorkers: 'block'});
      await context.addInitScript(language => {
        localStorage.setItem('offline_calendar_events_v2', '[]');
        localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({language, theme: 'dark'}));
      }, language);
      const pages = await Promise.all(['http://127.0.0.1:4177', 'http://127.0.0.1:4178'].map(async url => { const p = await context.newPage(); await p.goto(url); return p; }));
      const navName = language === 'pl' ? 'Widoki kalendarza' : 'Calendar views';
      for (const mode of [2, 3]) {
        for (const page of pages) await page.getByRole('navigation', {name: navName, exact: true}).getByRole('button').nth(mode).click();
        const dimensions = [];
        for (const page of pages) dimensions.push(await page.evaluate(() => {
          const label = document.querySelector('.timeline-all-day-label');
          const r = document.createRange(); r.selectNodeContents(label);
          const el = label.getBoundingClientRect(), text = r.getBoundingClientRect();
          const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
          return {label: [el.x, el.y, el.width, el.height], center: (text.left + text.right) / 2 - (el.left + el.right) / 2, row: box('.timeline-all-day-row'), axis: box('.timeline-hours'), column: box('.timeline-day'), content: label.textContent, overflow: document.documentElement.scrollWidth > innerWidth};
        }));
        assert.equal(dimensions[1].content, language === 'pl' ? 'Cały dzień' : 'All day');
        assert.ok(Math.abs(dimensions[1].center) < 1, `${language}/${mode}/${size.width}: label is not centered`);
        for (const key of ['label', 'row', 'axis', 'column']) assert.deepEqual(dimensions[1][key], dimensions[0][key], `${key} changed`);
        assert.equal(dimensions[1].overflow, false);
      }
      await context.close();
    }
    console.log('PASS: centered PL/EN label in day and week at 320, 390 and landscape; Beta 2 geometry preserved');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
