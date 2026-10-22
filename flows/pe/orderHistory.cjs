// Read-only recovery for a committed PE document whose application stayed blank.
// A rendered error, rejected API or expired session must still fail validation.
async function openPeOrderHistory(page, myOrders, { onRecovery = () => {} } = {}) {
  const target = new URL(myOrders.routes.orders, myOrders.origin);
  if (!/^https:\/\/stg2?\.shop\.samsung\.com$/.test(target.origin) ||
      target.pathname !== '/pe/mypage/orders') {
    throw new Error('Refusing order-history navigation outside PE staging.');
  }
  const heading = page.getByRole('heading', { name: /Mis pedidos|Pedidos|My Orders/i }).first();
  const navigate = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = new URL(target);
      if (attempt) url.searchParams.set('_qa_history_reload', String(Date.now()));
      const document = await page.goto(url.href, { waitUntil: 'commit', timeout: 15000 });
      if (!document?.ok()) throw new Error(`PE order-history document failed: HTTP ${document?.status() ?? 'unknown'}.`);
      myOrders.assertStagingUrl();
      try {
        await heading.waitFor({ state: 'visible', timeout: 20000 });
        const loaded = new URL(page.url());
        if (loaded.origin !== target.origin || loaded.pathname !== target.pathname) {
          throw new Error('PE order history left the expected authenticated route.');
        }
        return;
      } catch (error) {
        const current = new URL(page.url());
        const blank = !(await page.locator('body').innerText({ timeout: 3000 })).trim();
        if (attempt || error.name !== 'TimeoutError' || !blank ||
            current.origin !== target.origin || current.pathname !== target.pathname) throw error;
        onRecovery();
      }
    }
  };
  // Observe before navigating and handle both promises together: a failed
  // navigation cannot leave an unhandled response timeout behind.
  const history = page.waitForResponse(response => {
    const url = new URL(response.url());
    const apiHost = target.hostname.startsWith('stg2.') ? 's2' : 's1';
    return url.hostname === `${apiHost}-smb-api-cdn.ecom-stg.samsung.com` &&
      url.pathname === '/tokocommercewebservices/v2/pe/users/current/orders' &&
      response.request().method() === 'GET';
  }, { timeout: 75000 });
  const [response] = await Promise.all([history, navigate()]);
  if (response.status() !== 200) throw new Error(`Authenticated PE order history API failed: HTTP ${response.status()}.`);
  return response.json();
}

module.exports = { openPeOrderHistory };
