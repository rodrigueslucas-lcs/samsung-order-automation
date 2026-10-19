const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { preparePreQaCustomerPage } = require('../../utils/preQaCustomerState');

test('PreQA resets encrypted AEM cache without clearing WMC, commerce or other tabs', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: {
      cookies: [
        { name: 'flpe', value: 'fixture', domain: '.samsung.com', path: '/' },
        { name: 'flpe', value: 'fixture', domain: 'p6-pre-qa2.samsung.com', path: '/' },
        { name: 'flpe', value: 'fixture', domain: 'stg2.shop.samsung.com', path: '/' },
        { name: 'wmc', value: 'fixture', domain: '.samsung.com', path: '/' },
        { name: 'flpe', value: 'fixture', domain: 'foreign.example', path: '/' },
      ],
      origins: ['https://p6-pre-qa2.samsung.com', 'https://stg2.shop.samsung.com'].map(origin => ({
        origin, localStorage: ['flpe', 'dcgue', 'encGuid', 'other'].map(name => ({ name, value: 'fixture' })),
      })),
    } });
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Fixture</body></html>' }));
    const operator = await context.newPage();
    const page = await preparePreQaCustomerPage(context);
    const cookies = await context.cookies();
    assert.deepEqual(cookies.filter(c => c.name === 'flpe').map(c => c.domain).sort(),
      ['foreign.example', 'stg2.shop.samsung.com']);
    assert.equal(cookies.some(c => c.name === 'wmc'), true);
    await page.goto('https://p6-pre-qa2.samsung.com/mx/');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['other']);
    await page.goto('https://stg2.shop.samsung.com/mx/');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['dcgue', 'encGuid', 'flpe', 'other']);
    await page.close();
    assert.equal(operator.isClosed(), false);
    assert.equal(operator.url(), 'about:blank');
  } finally { await browser.close(); }
});
