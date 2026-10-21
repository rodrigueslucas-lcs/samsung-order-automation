const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { installCoNotificationReminder } = require('../../flows/co/notificationReminder.cjs');

for (const withButton of [true, false]) {
  test(`late CO notification overlay is dismissed natively before checkout action (button=${withButton})`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(`<button id="continue" onclick="window.continued=true">Continue</button>
        <div id="ins-frameless-overlay" close-on-click="true" style="display:none;position:fixed;inset:0;background:#ddd;z-index:2"
          onclick="this.style.display='none';document.querySelector('[role=dialog]').style.display='none'"></div>
        <div role="dialog" aria-modal="true" class="ins-preview-wrapper" style="display:none;position:fixed;inset:30px;z-index:3">
          <div class="ins-web-opt-in-reminder-body">Notifications</div>
          ${withButton ? `<button onclick="document.querySelector('#ins-frameless-overlay').click()">¡Listo!</button>` : ''}
        </div>`);
      await installCoNotificationReminder(page);
      await installCoNotificationReminder(page);
      await page.evaluate(() => {
        document.querySelector('#ins-frameless-overlay').style.display = 'block';
        document.querySelector('[role=dialog]').style.display = 'block';
      });
      await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 10000 });
      assert.equal(await page.evaluate(() => window.continued), true);
      assert.equal(await page.getByRole('dialog').isVisible(), false);
    } finally { await browser.close(); }
  });
}
