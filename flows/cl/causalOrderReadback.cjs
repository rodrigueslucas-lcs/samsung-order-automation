const { createCausalOrderReadback } = require('../../utils/causalOrderReadback.cjs');
const api = 'https://s2-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/cl';
const storefront = 'https://stg2.shop.samsung.com';
function assertClCheckout(page) {
  const url = new URL(page.url());
  if (url.origin !== storefront || url.pathname !== '/cl/checkout/one') throw new Error('CL causal reconciliation requires its S2 Base Store checkout.');
}
function assertClOrderReadRoute(page) {
  const url = new URL(page.url());
  if (url.origin !== storefront || !(url.pathname === '/cl/checkout/one' || /^\/cl\/orderConfirmation;orderCode=CL\d{6}-\d{8}(?:_\d+)?$/.test(url.pathname))) {
    throw new Error('CL causal order reads require the same S2 Base Store checkout or confirmation.');
  }
}
function isClCartResponse(response) {
  const url = new URL(response.url());
  return response.request().method() === 'GET' && url.href.split('?')[0] === api + '/users/current/carts/current';
}
async function createClReadbackFromCartResponse(page, response) {
  assertClCheckout(page);
  if (!response || !isClCartResponse(response) || !response.ok()) throw new Error('CL causal reconciliation requires its observed current-cart GET.');
  const cart = await response.json();
  if (cart.entries?.length !== 1 || cart.entries[0].quantity !== 1 || !cart.entries[0].product?.code || !(cart.totalPrice?.value > 0)) {
    throw new Error('CL causal reconciliation requires one controlled product and its total before submit.');
  }
  const authorization = await response.request().headerValue('authorization');
  return createCausalOrderReadback({ market: 'CL', site: 'cl' }, {
    sku: cart.entries[0].product.code, quantity: 1, expectedTotal: cart.totalPrice.value,
    read: async suffix => {
      assertClOrderReadRoute(page);
      const result = await page.context().request.get(api + suffix, {
        headers: authorization ? { authorization } : {}, maxRedirects: 0, timeout: 30000,
      }).catch(() => { throw new Error('CL causal order GET unavailable; no submit retry.'); });
      if (!result.ok()) throw new Error('CL causal order GET not accepted; no submit retry.');
      return result.json();
    },
  });
}
async function confirmClCreatedOrder(page, reader, baseline) {
  assertClOrderReadRoute(page);
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    result = await reader.afterSubmit(baseline);
    if (result) break;
    if (attempt < 2) await page.waitForTimeout(2000);
  }
  if (!result) throw new Error('CL 601 has no unique causal new order; no payment retry or confirmation PASS.');
  const url = new URL('/cl/orderConfirmation;orderCode=' + encodeURIComponent(result.orderCode), storefront);
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForURL(current => current.origin === storefront && current.pathname === url.pathname, { timeout: 60000 });
  await page.getByText(result.orderCode.replace(/_\d+$/, ''), { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 30000 });
  await page.getByText(/recibimos tu (?:orden|pedido).*exitos[ao]|gracias por tu compra|pedido confirmado|orden confirmada|pedido.*validaci[oó]n/i)
    .filter({ visible: true }).first().waitFor({ timeout: 30000 });
  return { ...result, outcome: 'CAUSAL_ORDER_CONFIRMED_AFTER_601', finalUrl: url.href };
}
module.exports = { isClCartResponse, createClReadbackFromCartResponse, confirmClCreatedOrder };
