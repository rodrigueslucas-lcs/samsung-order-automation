function watchEppProductRead(page, config) {
  const pending = new Set();
  const counts = { requested: 0, completed: 0, failed: 0 };
  let expectedPath = null;
  try {
    const root = new URL(config.rootUrl), pdp = new URL(config.pdpUrl);
    const site = config.apiSite || config.program;
    if (config.environment === 'S2' && root.origin === 'https://stg2.shop.samsung.com' &&
        pdp.origin === root.origin && pdp.pathname.startsWith(root.pathname) &&
        decodeURIComponent(pdp.pathname.split('/').filter(Boolean).at(-1)) === config.sku && /^[a-z0-9_]+$/i.test(site)) {
      expectedPath = `/tokocommercewebservices/v2/${site}/products/${encodeURIComponent(config.sku)}`;
    }
  } catch { /* Unproven scope never extends a readiness deadline. */ }
  const requested = request => {
    if (!expectedPath || request.method() !== 'GET') return;
    const url = new URL(request.url());
    if (['https://s2-smb-api-cdn.ecom-stg.samsung.com', 'https://stg2.shop.samsung.com'].includes(url.origin) && url.pathname === expectedPath) { pending.add(request); counts.requested++; }
  };
  const settled = request => { if(pending.delete(request))counts.completed++; };
  const failed = request => { if(pending.delete(request))counts.failed++; };
  page.on('request', requested);
  page.on('requestfinished', settled);
  page.on('requestfailed', failed);
  return {
    hasPending: () => pending.size > 0,
    snapshot: () => ({ ...counts, pending: pending.size }),
    stop: () => {
      page.off('request', requested); page.off('requestfinished', settled); page.off('requestfailed', failed); pending.clear();
    },
  };
}
module.exports = { watchEppProductRead };
