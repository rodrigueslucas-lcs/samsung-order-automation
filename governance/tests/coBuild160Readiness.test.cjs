const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { createCoPdpRecovery } = require('../../flows/co/pdpReadiness.cjs');
const { waitForCoShippingForm } = require('../../flows/co/shippingReadiness.cjs');
const { installCoNotificationReminder } = require('../../flows/co/notificationReminder.cjs');

test('empty CO PDP with truncated script recovers once without any cart mutation', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let requests = 0;
    await page.route('https://stg2.shop.samsung.com/co/p/TEST*', route => {
      requests++;
      assert.equal(route.request().method(), 'GET');
      return route.fulfill({ contentType: 'text/html', body: requests === 1 ?
        '<html><body><script>function broken(</script></body></html>' :
        '<main><button>Agregar al carrito</button></main>' });
    });
    const recovery = createCoPdpRecovery(page, { pdpUrl: 'https://stg2.shop.samsung.com/co/p/TEST' });
    const error = page.waitForEvent('pageerror');
    await page.goto('https://stg2.shop.samsung.com/co/p/TEST');
    await error;
    assert.equal(await recovery.recover(), true);
    assert.equal(await page.getByRole('button', { name: 'Agregar al carrito' }).isVisible(), true);
    assert.equal(await recovery.recover(), false);
    assert.equal(requests, 2);
    recovery.dispose();
  } finally { await browser.close(); }
});

test('rendered CO PDP and unrelated errors are never treated as blank-page recovery', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://stg2.shop.samsung.com/co/p/TEST', route => route.fulfill({
      contentType: 'text/html', body: '<main>Sold out</main><script>function broken(</script>',
    }));
    const recovery = createCoPdpRecovery(page, { pdpUrl: 'https://stg2.shop.samsung.com/co/p/TEST' });
    const error = page.waitForEvent('pageerror');
    await page.goto('https://stg2.shop.samsung.com/co/p/TEST');
    await error;
    assert.equal(await recovery.recover(), false);
    recovery.dispose();
  } finally { await browser.close(); }
});

for (const saved of [false, true]) test(`CO shipping has a single overlay-aware wait (saved address=${saved})`, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<section id="delivery">
      <mat-select name="regionIso" style="${saved ? 'display:none' : ''}">Departamento</mat-select>
      ${saved ? '<input name="addressOptionShipping" value="NEW_ADDRESS" type="radio">' : ''}</section>
      <div role="dialog" aria-modal="true" class="ins-preview-wrapper" style="position:fixed;inset:0;background:white">
      <div class="ins-web-opt-in-reminder-body">Notifications</div>
      <button onclick="window.dismissals=(window.dismissals||0)+1;this.parentElement.remove()">¡Listo!</button></div>`);
    await installCoNotificationReminder(page);
    await waitForCoShippingForm(page.locator('#delivery'));
    assert.equal(await page.evaluate(() => window.dismissals), 1);
    assert.equal(await page.getByRole('dialog').isVisible(), false);
  } finally { await browser.close(); }
});
