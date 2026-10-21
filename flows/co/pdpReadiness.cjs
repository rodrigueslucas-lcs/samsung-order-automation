// Recover only the proven empty-document + truncated-script signature, before Add.
function createCoPdpRecovery(page, config) {
  const target = new URL(config.pdpUrl);
  let syntaxFailure = false;
  let recovered = false;
  const onError = error => { if (/Unexpected end of input/i.test(error.message)) syntaxFailure = true; };
  page.on('pageerror', onError);
  return {
    dispose: () => page.off('pageerror', onError),
    recover: async () => {
      const current = new URL(page.url());
      if (recovered || !syntaxFailure || target.protocol !== 'https:' ||
          !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(target.hostname) ||
          !/^\/co\/p\/[^/]+$/.test(target.pathname) || current.origin !== target.origin || current.pathname !== target.pathname) return false;
      const empty = await page.evaluate(() => !document.querySelector('main') &&
        (document.body?.innerText || '').trim().length < 80);
      if (!empty) return false;
      recovered = true;
      const fresh = new URL(target);
      fresh.searchParams.set('_qa_pdp_recovery', String(Date.now()));
      await page.goto(fresh.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return true;
    },
  };
}
module.exports = { createCoPdpRecovery };
