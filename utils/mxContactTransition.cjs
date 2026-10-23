async function continueMxContactToDelivery(page, button, { timeout = 120000, now = Date.now } = {}) {
  const current = new URL(page.url());
  if (current.protocol !== 'https:' || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(current.hostname) || current.pathname !== '/mx/checkout/one') {
    throw new Error('MX contact transition requires the configured staging MX checkout.');
  }
  const apiHost = `${current.hostname.startsWith('stg2.') ? 's2' : 's1'}-smb-api-cdn.ecom-stg.samsung.com`;
  const deadline = now() + timeout;
  const remaining = () => Math.max(1, deadline - now());
  // The contact update can take almost a minute before the SPA opens Delivery.
  // Observe its actual response/body first; never submit contact a second time.
  const updated = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.protocol === 'https:' && url.hostname === apiHost &&
      url.pathname === '/tokocommercewebservices/v2/mx/users/current/carts/current/checkout/update' &&
      response.request().method() === 'POST';
  }, { timeout: remaining() });
  updated.catch(() => {});
  await button.click({ timeout: Math.min(10000, remaining()) });
  const response = await updated;
  if (!response.ok()) throw new Error(`MX contact update returned HTTP ${response.status()}; contact was not resubmitted.`);
  let timer;
  try {
    const failure = await Promise.race([
      response.finished(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MX contact update body did not finish within the transition deadline; contact was not resubmitted.')), remaining()); }),
    ]);
    if (failure) throw new Error('MX contact update body was interrupted; contact was not resubmitted.');
  } finally { clearTimeout(timer); }
  // Commit avoids waiting for unrelated analytics/load events. A visible
  // Delivery region is still required: URL alone is not business readiness.
  await page.waitForURL(url => url.origin === current.origin && url.pathname === current.pathname && url.searchParams.get('step') === 'CHECKOUT_STEP_DELIVERY', {
    waitUntil: 'commit', timeout: remaining(),
  });
  await page.getByRole('region', { name: /^2\. M[eé]todo de Entrega$/i })
    .waitFor({ state: 'visible', timeout: remaining() });
}

module.exports = { continueMxContactToDelivery };
