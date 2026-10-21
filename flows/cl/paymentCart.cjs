function validateClPaymentCartTarget(config) {
  const url = new URL(config.cartUrl);
  const hosts = { S1: 'stg.shop.samsung.com', S2: 'stg2.shop.samsung.com' };
  if (!hosts[config.environment] || url.protocol !== 'https:' || url.hostname !== hosts[config.environment] || url.pathname !== '/cl/cart') {
    throw new Error('CL payment cart preparation requires the S1/S2 staging cart.');
  }
  return `https://${config.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com/tokocommercewebservices/v2/cl/users/current/carts/current`;
}

async function prepareClPaymentCart(page, config) {
  const api = validateClPaymentCartTarget(config);
  const endpoint = new URL(api);
  const read = async () => {
    const pending = page.waitForResponse(r => {
      const url = new URL(r.url());
      return r.request().method() === 'GET' && url.origin === endpoint.origin && url.pathname === endpoint.pathname;
    }, { timeout: 60000 });
    await page.goto(config.cartUrl.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const response = await pending;
    if (!response.ok()) throw new Error(`CL payment cart read failed: HTTP ${response.status()}.`);
    const cart = await response.json();
    if (!Array.isArray(cart.entries) || cart.entries.length > 10) throw new Error('CL payment cart has an unsupported entry schema or more than ten entries.');
    return { cart, response };
  };
  let state = await read();
  const removed = new Set();
  for (let n = 0; n < 10; n++) {
    const other = state.cart.entries.find(entry => entry.product?.code !== config.sku && !entry.isServiceEntry);
    if (!other) {
      if (state.cart.entries.some(entry => entry.isServiceEntry)) throw new Error('CL card test requires a product-only cart, without added services.');
      return;
    }
    if (!Number.isInteger(other.entryNumber) || !other.product?.code || removed.has(other.product.code)) {
      throw new Error('CL cart removal did not persist or entry identity is invalid; no deletion will be retried.');
    }
    removed.add(other.product.code);
    const authorization = await state.response.request().headerValue('authorization');
    const response = await page.context().request.delete(`${api}/entries/${other.entryNumber}`, {
      headers: authorization ? { authorization } : {}, timeout: 30000,
    });
    if (!response.ok()) throw new Error(`CL payment cart removal failed: HTTP ${response.status()}.`);
    state = await read();
    if (state.cart.entries.some(entry => entry.product?.code === other.product.code)) {
      throw new Error('CL payment cart still contains the removed product; no deletion will be retried.');
    }
  }
  throw new Error('CL payment cart preparation exceeded ten product removals.');
}

module.exports = { prepareClPaymentCart, validateClPaymentCartTarget };
