const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium, expect } = require('@playwright/test');

test('CL waits for late address pagination and proves the requested marker after expanding', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent('<article class="card">Existing address</article>');
    await page.evaluate(() => setTimeout(() => {
      const more = document.createElement('button'); more.textContent = 'Ver más';
      more.onclick = () => {
        document.body.dataset.expansions = String(Number(document.body.dataset.expansions || 0) + 1);
        const address = document.createElement('article'); address.className = 'card';
        address.textContent = 'QA AUTOMATION REQUESTED'; document.body.append(address); more.remove();
      };
      document.body.append(more);
    }, 250));
    const source = fs.readFileSync('pages/ProfilePage.js', 'utf8')
      .replace(/^import .*;\r?\n/gm, '').replace('export default class ProfilePage', 'class ProfilePage');
    const Page = vm.runInNewContext(source + '\nProfilePage;', { MyAccountPage: class {}, expect, process: { env: {} } });
    const profile = Object.create(Page.prototype);
    profile.page = page; profile.market = 'cl'; profile.addressCards = page.locator('.card');
    await profile.expandClAddressesUntil('QA AUTOMATION REQUESTED');
    await expect(page.getByText('QA AUTOMATION REQUESTED', { exact: true })).toBeVisible();
    assert.equal(await page.locator('body').getAttribute('data-expansions'), '1');
  } finally { await browser.close(); }
});
