const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');

test('MX S2 Base capture excludes saved-card details and order history while preserving EPP scope', async () => {
  const source = fs.readFileSync('pages/MarketPaymentPage.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default class MarketPaymentPage', 'class MarketPaymentPage');
  const Page = vm.runInNewContext(source + '\nMarketPaymentPage;', {
    URL, PaymentPage: class {
      constructor(page) { this.page = page; }
      async placeOrderAndCapture(options) { return options; }
    }, paymentMarketProfile: { getPaymentMarketProfile: () => ({ code: 'MX' }) }, destructiveGuards: {},
  });
  const page = { url: () => 'https://stg2.shop.samsung.com/mx/checkout/one',
    getByRole: () => ({ filter() { return this; }, first() { return this; } }) };
  const payment = new Page(page, { market: 'MX' });
  const options = await payment.placeOrderAndCapture();
  assert.equal(options.orderResponsePathPattern.test('/tokocommercewebservices/v2/mx/users/current/orders/MX261119-78896156_261119223444729'), true);
  for (const path of ['/tokocommercewebservices/v2/mx/users/current/carts/current/paymentmodes/mx-mercadoCc/details',
    '/tokocommercewebservices/v2/mx/users/current/orders',
    '/tokocommercewebservices/v2/cl/users/current/orders/CL261119-78896156']) {
    assert.equal(options.orderResponsePathPattern.test(path), false);
  }
  page.url = () => 'https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/checkout/one';
  assert.equal((await payment.placeOrderAndCapture()).orderResponsePathPattern, undefined);
});

test('MX confirmation waits for its own receipt and rejects missing UI or foreign scopes without submitting', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    let writes = 0;
    await page.route('**/*', route => {
      if (route.request().method() !== 'GET') writes++;
      return route.fulfill({ contentType: 'text/html', body: '<body>Waiting</body>' });
    });
    const source = fs.readFileSync('pages/MarketPaymentPage.js', 'utf8')
      .replace(/^import .*;\r?\n/gm, '').replace('export default class MarketPaymentPage', 'class MarketPaymentPage');
    const Page = vm.runInNewContext(source + '\nMarketPaymentPage;', {
      URL, PaymentPage: class { constructor(page) { this.page = page; } },
      paymentMarketProfile: { getPaymentMarketProfile: () => ({ code: 'MX' }) }, destructiveGuards: {},
    });
    const payment = new Page(page, { market: 'MX' });
    const code = 'MX261119-78896156_261119220516627';
    await page.goto('https://stg2.shop.samsung.com/mx/checkout/one');
    await page.evaluate(code => setTimeout(() => {
      history.pushState({}, '', '/mx/orderConfirmation;orderCode=' + code);
      document.body.innerHTML = '<h1>Recibimos tu pedido de manera exitosa</h1><p>' + code.split('_')[0] + '</p>';
    }, 150), code);
    assert.equal((await payment.validateMxOrderConfirmation(code, { timeout: 3000 })).confirmationValidated, true);
    await page.goto('https://stg2.shop.samsung.com/mx/orderConfirmation;orderCode=MX261119-78896156_999');
    await assert.rejects(payment.validateMxOrderConfirmation(code, { timeout: 200 }), /captured order/);
    await page.goto('https://stg2.shop.samsung.com/mx/orderConfirmation?orderCode=' + code);
    await page.setContent('<p>MX261119-78896156</p>');
    await assert.rejects(payment.validateMxOrderConfirmation(code, { timeout: 200 }), /Timeout/);
    for (const url of ['https://shop.samsung.com/mx/checkout/one',
      'https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/checkout/one',
      'https://stg2.shop.samsung.com/cl/checkout/one']) {
      await page.goto(url); // All URLs are fulfilled locally above; no Production request is sent.
      await assert.rejects(payment.validateMxOrderConfirmation(code, { timeout: 200 }), /S2 Base Store/);
      assert.equal(page.url(), url);
    }
    assert.equal(writes, 0);
  } finally { await browser.close(); }
});

for (const label of ['Tarjeta de Débito/Crédito', 'Tarjeta de Crédito / Débito']) {
  test(`MX waits for the native ${label} panel instead of initiating a wallet order`, async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
      const page = await browser.newPage();
      await page.setContent('<button>Billeteras digitales</button><button>Tarjeta de Crédito</button>');
      await page.evaluate(label => setTimeout(() => {
        const card = document.createElement('button'); card.textContent = label; document.body.append(card);
      }, 200), label);
      let native = 0;
      const source = fs.readFileSync('pages/MarketPaymentPage.js', 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace('export default class MarketPaymentPage', 'class MarketPaymentPage');
      const Page = vm.runInNewContext(source + '\nMarketPaymentPage;', {
        PaymentPage: class {
          constructor(page) { this.page = page; }
          async selectCreditCard() { native++; await this.creditCardOption.click(); }
        }, paymentMarketProfile: { getPaymentMarketProfile: () => ({ code: 'MX' }) },
        destructiveGuards: {},
      });
      const payment = new Page(page, { market: 'MX' });
      // Any wallet click would initiate an unintended CheckoutPro order.
      await page.getByRole('button', { name: 'Billeteras digitales' }).evaluate(el => {
        el.onclick = () => { document.body.dataset.walletClicked = 'true'; };
      });
      await payment.selectCreditCard();
      assert.equal(native, 1);
      assert.equal(await payment.creditCardOption.innerText(), label);
      assert.equal(await page.locator('body').getAttribute('data-wallet-clicked'), null);
    } finally { await browser.close(); }
  });
}

test('MX credit-card scenario selects the offered credit panel rather than debit or wallets', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="debit"><h2>Tarjeta de Débito/Crédito</h2></button><button id="wallet"><h2>Billeteras digitales</h2></button><button id="credit"><h2>Tarjeta de Crédito</h2></button>');
    await page.locator('button').evaluateAll(buttons => buttons.forEach(button => {
      button.onclick = () => { document.body.dataset.selected = button.id; };
    }));
    const source = fs.readFileSync('pages/MarketPaymentPage.js', 'utf8')
      .replace(/^import .*;\r?\n/gm, '').replace('export default class MarketPaymentPage', 'class MarketPaymentPage');
    const Page = vm.runInNewContext(source + '\nMarketPaymentPage;', {
      PaymentPage: class {
        constructor(page) { this.page = page; }
        async selectCreditCard() { await this.creditCardOption.click(); }
      }, paymentMarketProfile: { getPaymentMarketProfile: () => ({ code: 'MX' }) }, destructiveGuards: {},
    });
    await new Page(page, { market: 'MX', cardPanel: 'credit' }).selectCreditCard();
    assert.equal(await page.locator('body').getAttribute('data-selected'), 'credit');
    assert.throws(() => new Page(page, { market: 'MX', cardPanel: 'wallet' }), /must be credit or debit/);
  } finally { await browser.close(); }
});
