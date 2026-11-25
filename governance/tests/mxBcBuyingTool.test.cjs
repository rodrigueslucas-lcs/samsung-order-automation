const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');

test('BC Continue banner cannot submit cart; native cart action selects only the intended SKU', async () => {
  const source = fs.readFileSync(path.resolve(__dirname,
    '../../flows/mx/bcAddToCart.js'), 'utf8');
  const start = source.indexOf('function preQaAddToCart(');
  const end = source.indexOf('async function getAuthenticatedPreQaPage(');
  assert.ok(start >= 0 && end > start);
  const actions = vm.runInNewContext(`${source.slice(start, end)}; ({ preQaAddToCart, dismissLocationBanner });`, {
    PRE_QA_MODEL_CODE: 'SM-F956BDBMLTM',
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="location" onclick="this.remove()">Continuar</button>
      <a role="button" an-ac="addToCart" data-modelcode="OTHER" onclick="this.dataset.clicked='true'">Continuar</a>
      <a role="button" an-ac="addToCart" data-modelcode="SM-F956BDBMLTM" onclick="this.dataset.clicked='true'">Continuar</a>
    `);
    await actions.dismissLocationBanner(page);
    assert.equal(await page.locator('#location').count(), 0);
    assert.equal(await page.locator('[data-clicked]').count(), 0);
    await actions.dismissLocationBanner(page);
    assert.equal(await page.locator('[data-clicked]').count(), 0);
    await actions.preQaAddToCart(page).click();
    assert.deepEqual(await page.locator('[data-clicked]').evaluateAll(
      elements => elements.map(element => element.getAttribute('data-modelcode'))), ['SM-F956BDBMLTM']);
  } finally {
    await browser.close();
  }
});
