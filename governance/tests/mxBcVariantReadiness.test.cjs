const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectMxBcVariant } = require('../../utils/mxBcVariantReadiness.cjs');
test('native label selects exactly the configured SKU and leaves Add untouched', async () => {
  const browser = await require('@playwright/test').chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://p6-pre-qa2.samsung.com/**', route => route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><div><input type="radio" name="basic-color" id="navy" data-modelcode="SM-F956BDBMLTM"><label for="navy">Navy</label></div><button onclick="window.added=true">Add</button>'}));
    await page.goto('https://p6-pre-qa2.samsung.com/mx/smartphones/galaxy-z-fold6/buy/');
    await selectMxBcVariant(page,'SM-F956BDBMLTM');
    assert.equal(await page.locator('#navy').isChecked(),true);
    assert.equal(await page.evaluate(()=>window.added===true),false);
  } finally { await browser.close(); }
});
function fixture({ otherColors = 0, recovered = false, url = 'https://p6-pre-qa2.samsung.com/mx/smartphones/galaxy-z-fold6/buy/' } = {}) {
  let reloads = 0, clicks = 0;
  const color = { waitFor: async () => { if (!recovered || reloads === 0) throw Error('absent'); }, locator: () => ({ locator: () => ({ click: async () => { clicks++; throw Error('native selection reached'); } }) }) };
  return { page: { url: () => url, locator: selector => selector.includes('data-modelcode') ? color : { count: async () => otherColors }, reload: async () => { reloads++; } }, counts: () => ({ reloads, clicks }) };
}
test('missing native module gets one document GET but cannot pass or select another model', async () => {
  const f = fixture(); await assert.rejects(selectMxBcVariant(f.page, 'SM-F956BDBMLTM'), /MX_BC_VARIANT_CONTROL_UNAVAILABLE/);
  assert.deepEqual(f.counts(), { reloads: 1, clicks: 0 });
});
test('rendered colors missing the configured model fail without reloading or substituting', async () => {
  const f = fixture({ otherColors: 3 }); await assert.rejects(selectMxBcVariant(f.page, 'SM-F956BDBMLTM'), /MX_BC_VARIANT_CONTROL_UNAVAILABLE/);
  assert.deepEqual(f.counts(), { reloads: 0, clicks: 0 });
});
test('recovered exact native model is selected once, never an Add action', async () => {
  const f = fixture({ recovered: true }); await assert.rejects(selectMxBcVariant(f.page, 'SM-F956BDBMLTM'), /native selection reached/);
  assert.deepEqual(f.counts(), { reloads: 1, clicks: 1 });
});
for (const url of ['https://www.samsung.com/mx/smartphones/galaxy-z-fold6/buy/', 'https://p6-pre-qa2.samsung.com/apps/samsung/login/']) test('variant recovery refuses unrelated origin or auth gate', async () => {
  const f = fixture({ url }); await assert.rejects(selectMxBcVariant(f.page, 'SM-F956BDBMLTM'), /SCOPE_INVALID/); assert.deepEqual(f.counts(), { reloads: 0, clicks: 0 });
});
