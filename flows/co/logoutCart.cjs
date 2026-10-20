const { expect } = require('@playwright/test');

async function logoutCoCartAndValidateSignedOut(page, config, logout) {
  const target = new URL(config.cartUrl);
  if (target.protocol !== 'https:' ||
      !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(target.hostname) ||
      target.pathname !== '/co/cart') {
    throw new Error('CO logout validation is restricted to the S1/S2 staging cart.');
  }
  const logoutResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && url.origin === target.origin && url.pathname === '/co/logout';
  }, { timeout: 60000 });
  const cartDocument = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().isNavigationRequest() && response.request().method() === 'GET' &&
      url.origin === target.origin && url.pathname === target.pathname;
  }, { timeout: 60000 });
  // The URL is already /co/cart before logout. Wait for new responses rather
  // than treating that existing URL as proof that the redirect has finished.
  // Keep the pointer on the profile trigger: moving it toward a text span can
  // close/recreate this hover menu. Enter activates its actual native button.
  const [response, returned] = await Promise.all([logoutResponse, cartDocument, logout.press('Enter')]);
  if (![200, 302, 303, 307, 308].includes(response.status()) || returned.status() !== 200) {
    throw new Error(`CO logout/return failed (HTTP ${response.status()}/${returned.status()}); logout was not retried.`);
  }
  for (const document of [response, returned]) {
    if (await document.finished()) throw new Error('CO logout/return was interrupted; logout was not retried.');
  }
  await page.waitForURL(target.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const profile = page.getByRole('button', { name: 'My Profile', exact: true });
  await profile.waitFor({ state: 'visible', timeout: 60000 });
  const menu = page.locator('[role="menu"].profile-menu').filter({ visible: true }).last();
  const signIn = menu.locator('[data-an-la="login"]').filter({ visible: true }).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await profile.hover();
    const visible = await signIn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
    if (visible) {
      await expect(menu.getByText(/Cerrar Sesi[oó]n/i)).toHaveCount(0);
      return { logoutStatus: response.status(), returnStatus: returned.status(), menuAttempts: attempt };
    }
  }
  throw new Error('CO logout returned to cart, but the signed-out profile action was not proven after three menu openings.');
}

module.exports = { logoutCoCartAndValidateSignedOut };
