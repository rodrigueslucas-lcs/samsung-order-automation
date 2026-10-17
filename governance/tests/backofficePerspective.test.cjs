const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');

test('BackOffice admin readiness accepts real admin shells and rejects unrelated Order rows', async () => {
  const source = fs.readFileSync('pages/BackOfficePage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export default /gm, '').replace(/^export /gm, '');
  const BackOfficePage = vm.runInNewContext(`${source}\nBackOfficePage;`, { BasePage: class {}, process, URL });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const bo = Object.create(BackOfficePage.prototype);
    bo.page = page;
    for (const html of [
      '<div>Administration Cockpit</div>',
      '<section role="tabpanel" aria-label="admin.area"><div role="row">Order</div></section>',
      '<div hidden>Administration Cockpit</div><section role="tabpanel" aria-label="admin.area"><div role="row">Order selected</div></section>',
    ]) {
      await page.setContent(html);
      await bo.expectPerspective('admin');
      assert.equal(await bo.adminPerspective().count(), 1);
    }
    for (const html of [
      '<div role="row">Order</div><button>User Profile</button>',
      '<section role="tabpanel" aria-label="customer.support"><div role="row">Order</div></section>',
      '<section hidden role="tabpanel" aria-label="admin.area"><div role="row">Order</div></section>',
    ]) {
      await page.setContent(html);
      assert.equal(await bo.adminPerspective().count(), 0);
    }
    await page.setContent('<div>Customer Support</div>');
    await bo.expectPerspective('agent');
    assert.equal(await bo.adminPerspective().count(), 0);
    await page.setContent('<div>Administration Cockpit</div><div id="zk_proc">Processing...</div>');
    await page.evaluate(() => setTimeout(() => document.querySelector('#zk_proc').remove(), 100));
    await bo.expectPerspective('admin');
    assert.equal(await page.locator('#zk_proc').count(), 0, 'Admin readiness must wait for ZK processing to finish.');
  } finally {
    await browser.close();
  }
});
