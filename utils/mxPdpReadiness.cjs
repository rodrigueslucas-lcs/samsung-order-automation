// Observe only the configured MX product reads. A slow read must not be
// cancelled by a PDP reload while the purchase component is still hydrating.
function watchMxPdpReads(page, pdpUrl) {
  const pdp = new URL(pdpUrl);
  const match = pdp.pathname.match(/^\/mx\/p\/([A-Z0-9-]+)$/);
  const environment = {'stg.shop.samsung.com':'s1','stg2.shop.samsung.com':'s2'}[pdp.hostname];
  if (pdp.protocol !== 'https:' || !environment || !match) throw new Error('MX PDP observation requires its exact staging route.');
  const origin = `https://${environment}-smb-api-cdn.ecom-stg.samsung.com`;
  const pathname = `/tokocommercewebservices/v2/mx/products/${match[1]}`;
  const pending = new Set(), waiters = new Set();
  const onRequest = request => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.origin === origin && url.pathname === pathname) pending.add(request);
  };
  const onFinished = request => {
    pending.delete(request);
    if (!pending.size) for (const resolve of [...waiters]) resolve();
  };
  page.on('request', onRequest);
  page.on('requestfinished', onFinished);
  page.on('requestfailed', onFinished);
  return {
    pending: () => pending.size > 0,
    async settle(timeout = 60000) {
      if (!pending.size) return;
      let timer, finish;
      try {
        await new Promise(resolve => {
          finish = resolve;waiters.add(finish);
          timer = setTimeout(resolve, timeout);
        });
      } finally { clearTimeout(timer);waiters.delete(finish); }
    },
    dispose() {
      page.off('request', onRequest);
      page.off('requestfinished', onFinished);
      page.off('requestfailed', onFinished);
      pending.clear();
      for (const resolve of [...waiters]) resolve();
    },
  };
}
module.exports = { watchMxPdpReads };
