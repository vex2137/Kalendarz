const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const spec = require('../src/utils/builtinThemes.json');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const page = await context.newPage(); await page.goto('http://127.0.0.1:4179');
    await page.locator('#btn-open-settings').click();
    const vars = ['--bg-main','--bg-surface','--bg-header','--bg-subtle','--bg-hover','--border-color','--text-main','--text-muted','--accent-color','--accent-text','--button-bg','--button-hover','--button-text'];
    for (const theme of spec.themes) {
      await page.getByRole('button', {name:new RegExp('^'+theme.en+'(?: ✓)?$')}).click();
      const values = await page.evaluate(names => names.map(name => getComputedStyle(document.documentElement).getPropertyValue(name).trim().toUpperCase()), vars);
      assert.deepEqual(values, theme.colors, `${theme.id} CSS variables`);
    }
    await page.getByRole('button', {name:'Create theme',exact:true}).click();
    await page.getByLabel('Theme name', {exact:true}).fill('Duplicated Inferno');
    assert.equal((await page.getByLabel('Background HEX', {exact:true}).inputValue()).toUpperCase(), '#09090B');
    await page.getByLabel('Background HEX', {exact:true}).fill('#123456');
    assert.equal(await page.getByLabel('Background', {exact:true}).inputValue(), '#123456');
    await page.getByRole('button', {name:'Restore colors',exact:true}).click();
    assert.equal((await page.getByLabel('Background HEX', {exact:true}).inputValue()).toUpperCase(), '#09090B');
    await page.getByLabel('Background HEX', {exact:true}).fill('#123456');
    await page.getByRole('button', {name:'Save theme',exact:true}).click();
    await page.reload(); await page.locator('#btn-open-settings').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')));
    assert.equal(saved.customThemes[0].colors.background, '#123456');
    await page.getByRole('button', {name:'Delete theme: Duplicated Inferno'}).click();
    await page.getByRole('button', {name:'Delete',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('offline_calendar_settings_v2')).customThemes.length === 0);
    console.log('PASS: 104 rendered palette values; duplicate, HEX editing, reset, persistence and confirmed deletion');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
