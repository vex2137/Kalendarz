const assert = require('node:assert/strict');
// Shared by browser, packaged Electron and Android tests: rules must never stand
// in for proof of real GGUF execution. The diagnostic invokes the engine directly.
module.exports = async function verifyDeviceModel(page, language) {
  const text = language === 'pl' ? ['Diagnostyka AI', 'Test telefonu: zimny + ciepły'] : ['AI diagnostics', 'Device test: cold + warm'];
  const metrics = [];
  const listener = message => { if (message.text().startsWith('Local model performance:')) metrics.push(JSON.parse(message.text().slice('Local model performance:'.length))); };
  page.on('console', listener);
  try {
    const details = page.locator('details').filter({ has: page.getByText(text[0], { exact: true }) });
    await details.locator('summary').click();
    await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.textContent === label && !b.disabled), text[1], { timeout: 180000 });
    await page.getByRole('button', { name: text[1], exact: true }).click();
    console.log('Running real cold/warm device probe', language);
    const end = Date.now() + 300000;
    while (metrics.length < 2 && Date.now() < end) {
      if (await details.getByRole('alert').count()) throw new Error(await details.getByRole('alert').innerText());
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(metrics.length, 2, 'Both cold and warm calls must execute the actual GGUF');
    for (const metric of metrics) {
      assert.ok(metric.promptTokens > 0 && metric.completionTokens > 0);
      assert.ok(Number.isFinite(metric.promptMs) && Number.isFinite(metric.generationMs));
    }
    assert.ok(metrics[1].cachedTokens > 0, 'Warm model call must reuse the actual prompt');
    await details.locator('summary').click();
    return metrics;
  } finally { page.off('console', listener); }
};
