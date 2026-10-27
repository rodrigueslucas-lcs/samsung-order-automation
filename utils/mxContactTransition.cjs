async function continueMxCheckoutUpdate(page, button, { timeout = 120000, now = Date.now, storefront = null } = {}, targetStep, region) {
  const {url:current,site}=require('./mxStorefrontScope.cjs').resolveMxStorefrontScope(page.url(),storefront,'checkout/one');
  const apiHost = `${current.hostname.startsWith('stg2.') ? 's2' : 's1'}-smb-api-cdn.ecom-stg.samsung.com`;
  const deadline = now() + timeout;
  const remaining = () => Math.max(1, deadline - now());
  // The contact update can take almost a minute before the SPA opens Delivery.
  // Observe its actual response/body first; never submit contact a second time.
  const updated = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.protocol === 'https:' && url.hostname === apiHost &&
      url.pathname === `/tokocommercewebservices/v2/${site}/users/current/carts/current/checkout/update` &&
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
  await page.waitForURL(url => url.origin === current.origin && url.pathname === current.pathname && url.searchParams.get('step') === targetStep, {
    waitUntil: 'commit', timeout: remaining(),
  });
  await page.getByRole('region', { name: region })
    .waitFor({ state: 'visible', timeout: remaining() });
}

function continueMxContactToDelivery(page,button,options){return continueMxCheckoutUpdate(page,button,options,'CHECKOUT_STEP_DELIVERY',/^2\. M[eé]todo de Entrega$/i);}
function continueMxDeliveryToPayment(page,button,options={}){
  if(!options.storefront)throw new Error('EPP delivery transition requires an explicit programme scope.');
  return continueMxCheckoutUpdate(page,button,options,'CHECKOUT_STEP_PAYMENT',/^3\. M[eé]todos de Pago$/i);
}
module.exports = { continueMxContactToDelivery, continueMxDeliveryToPayment };
