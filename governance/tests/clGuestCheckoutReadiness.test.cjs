const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium, expect } = require('@playwright/test');
const source = fs.readFileSync('pages/CartPage.js', 'utf8')
 .replace(/^import .*;\r?\n/gm, '').replace('export default class CartPage', 'class CartPage');
const Cart = vm.runInNewContext(`${source}\nCartPage;`, { BasePage: class {}, URL, Date, console, expect });
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function scenario(environment, { registered = false, render = true, market = 'cl' } = {}) {
 const context = await browser.newContext();
 const page = await context.newPage();
 const origin = environment === 'S1' ? 'https://stg.shop.samsung.com' : 'https://stg2.shop.samsung.com';
 await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `
 <button onclick="beginCheckout(this)">Continuar</button>
 <script>function beginCheckout(button) {
  history.pushState({},'', '/${market}/guestlogin/checkout'); button.remove();
  ${render ? `setTimeout(()=>{document.body.innerHTML='<input placeholder="Ingresa tu correo"><button>Iniciar sesión</button>'},1500)` : ''}
 }</script>` }));
 await page.goto(`${origin}/${market}/cart`);
 const cart = Object.create(Cart.prototype);
 Object.assign(cart, { page, cartUrl: `${origin}/${market}/cart`, guestEmailPattern: /Ingresa tu correo/i,
  continueButton: page.getByRole('button', { name: 'Continuar', exact: true }), screenshot: async () => {} });
 return { context, page, cart, registered };
}
for (const market of ['cl', 'mx']) for (const environment of ['S1', 'S2']) {
 test(`${market.toUpperCase()} ${environment} waits for guest login hydration after route navigation without replaying checkout`, async () => {
  const f = await scenario(environment, { market });
  try {
   let reloads = 0; f.page.on('request', request => { if (request.isNavigationRequest()) reloads++; });
   await f.cart.proceedToCheckout();
   assert.equal(await f.page.getByPlaceholder('Ingresa tu correo').isVisible(), true);
   assert.equal(new URL(f.page.url()).pathname, `/${market}/guestlogin/checkout`);
   assert.equal(reloads, 0, 'hydration must not trigger another navigation/submit');
  } finally { await f.context.close(); }
 });
}
test('registered CL checkout still rejects an unexpected guest redirect', async () => {
 const f = await scenario('S2', { registered: true });
 try { await assert.rejects(f.cart.proceedToAuthenticatedCheckout(), /Samsung Account session was not accepted/); }
 finally { await f.context.close(); }
});
test('CL guest route without a rendered email form still fails instead of accepting the URL', async () => {
 const f = await scenario('S2', { render: false });
 try {
  let navigations = 0; f.page.on('request', request => { if (request.isNavigationRequest()) navigations++; });
  await assert.rejects(f.cart.proceedToCheckout(), /Timeout.*30000ms/);
  assert.equal(navigations, 0, 'missing UI must not replay checkout');
 } finally { await f.context.close(); }
});
