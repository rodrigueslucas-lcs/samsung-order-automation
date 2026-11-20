const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium, expect } = require('@playwright/test');

function accountClass() {
  const source = fs.readFileSync('pages/MxMyAccountPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default class MxMyAccountPage', 'class MxMyAccountPage');
  return vm.runInNewContext(source + '\nMxMyAccountPage;', {
    expect, URL, BasePage: class { constructor(page) { this.page = page; } },
  });
}

test('MX uses profile-setting and validates the account navigation, excluding compact dropdown and footer substitutes', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const paths = [];
    await page.route('https://stg2.shop.samsung.com/**', route => {
      paths.push(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: 'text/html', body: '<h1>Ajustes de perfil</h1><div role="menu">QA User Cerrar sesión</div>' });
    });
    await page.goto('https://stg2.shop.samsung.com/mx/');
    const Account = accountClass();
    const account = new Account(page);
    await account.openProfileSettings();
    const entries = [['Mi cuenta', ''], ['Mis productos', '/myproducts/'], ['Mis Rewards', '/rewards/'],
      ['Mis órdenes', '/orders'], ['Wish List', '/wishlist'], ['Mis Suscripciones', '/subscriptions']];
    const links = entries.map(([name, path], i) => `<li><a href="${i === 0 ? 'https://www.samsung.com' : i === 2 ? 'https://p6-pre-qa.samsung.com' : ''}/mx/mypage${path || '/'}">${name}</a></li>`).join('');
    await page.evaluate(html => setTimeout(() => {
      document.body.insertAdjacentHTML('beforeend', '<ul class="lower-nav-links-mx">' + html + '</ul>');
    }, 100), links);
    assert.equal((await account.validateNavigation({ timeout: 3000 })).length, 6);
    assert.equal(paths.includes('/mx/mypage/'), false);
    assert.equal(paths.includes('/mx/mypage/profile-setting'), true);
    // All links are still present in the footer; they cannot replace a missing account option.
    await page.locator('body').evaluate((el, html) => el.insertAdjacentHTML('beforeend', '<footer>' + html + '</footer>'), links);
    await page.locator('ul.lower-nav-links-mx li').last().evaluate(el => el.remove());
    await assert.rejects(account.validateNavigation({ timeout: 200 }), /Mis Suscripciones/);
    await page.locator('ul.lower-nav-links-mx').evaluate((el, html) => { el.innerHTML = html; }, links);
    await page.locator('ul.lower-nav-links-mx a').nth(1).evaluate(el => { el.href = 'https://foreign.example/mx/mypage/myproducts/'; });
    await assert.rejects(account.validateNavigation({ timeout: 200 }), /unexpected destination/);
    await page.locator('ul.lower-nav-links-mx').evaluate(el => el.remove());
    await assert.rejects(account.validateNavigation({ timeout: 200 }), /Timeout/);
    assert.equal(page.url(), 'https://stg2.shop.samsung.com/mx/mypage/profile-setting');
  } finally { await browser.close(); }
});

test('MX account route refuses Production and other markets before navigation', async () => {
  const Account = accountClass();
  for (const url of ['https://shop.samsung.com/mx/', 'https://stg2.shop.samsung.com/cl/']) {
    let navigations = 0;
    const account = new Account({ url: () => url, goto: async () => { navigations++; } });
    await assert.rejects(account.openProfileSettings(), /S2 MX storefront/);
    assert.equal(navigations, 0);
  }
});
