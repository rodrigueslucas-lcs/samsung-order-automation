const { prepareAuthBrowserWindow } = require('./authBrowserWindow.cjs');
const { assertAuthStorefrontHealth } = require('./authStorefrontHealth.cjs');

function authProfileControl(page) {
  return page.getByRole('button', { name: 'My Profile', exact: true })
    .or(page.locator('button[data-an-la="L0_13_login"], button.nv00-gnb-v4__utility-user'))
    .filter({ visible: true }).first();
}

function authActions(page) {
  return {
    login: page.locator('[data-an-la="login"], a.loginBtn')
      .or(page.getByRole('button', { name: /^Iniciar sesi[oó]n(?:\/Registrarse)?$|^Sign in$/i }))
      .or(page.getByRole('link', { name: /^Iniciar sesi[oó]n(?:\/Registrarse)?$|^Sign in$/i }))
      .or(page.getByText(/^Iniciar sesi[oó]n(?:\/Registrarse)?$|^Sign in$/i))
      .filter({ visible: true }).first(),
    logout: page.getByText(/Cerrar Sesi[oó]n|Sign out/i).filter({ visible: true }).first(),
  };
}

async function openAuthProfile(page, { market, prepareWindow = prepareAuthBrowserWindow } = {}) {
  await prepareWindow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const notice = page.getByText(/^¡Listo!$|^Got it$/i).filter({ visible: true }).first();
  if (await notice.isVisible()) await notice.click({ timeout: 3000 });
  const profile = authProfileControl(page);
  await profile.waitFor({ state: 'visible', timeout: 30000 });
  const { login, logout } = authActions(page);
  const result = async state => {
    // AEM also renders a non-interactive "Iniciar sesión/Registrarse" title.
    // Locator.or() uses DOM order, not selector preference: prefer the actual
    // login action over that earlier title after the menu has become visible.
    const actions = [page.locator('[data-an-la="login"]').filter({ visible: true }).first(),
      page.locator('a.loginBtn').filter({ visible: true }).first(),
      page.getByRole('button', { name: /^Iniciar sesi[oó]n(?:\/Registrarse)?$|^Sign in$/i }).filter({ visible: true }).first(),
      page.getByRole('link', { name: /^Iniciar sesi[oó]n(?:\/Registrarse)?$|^Sign in$/i }).filter({ visible: true }).first()];
    for (const action of actions) if (await action.isVisible()) return { profile, state, login: action, logout };
    return { profile, state, login, logout };
  };
  const visibleState = async () => {
    const [out, signIn] = await Promise.all([logout.isVisible(), login.isVisible()]);
    return out && !signIn ? 'authenticated' : signIn && !out ? 'signed-out' : null;
  };
  const read = async timeout => {
    const current = await visibleState();
    if (current) return current;
    await Promise.any([
      logout.waitFor({ state: 'visible', timeout }).then(() => 'authenticated'),
      login.waitFor({ state: 'visible', timeout }).then(() => 'signed-out'),
    ]).catch(() => null);
    return visibleState();
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    // Never toggle a menu whose authenticated actions are already visible.
    const current = await visibleState();
    if (current) return result(current);
    await page.mouse.move(0, 0);
    await profile.hover({ timeout: 5000 });
    let state = await read(3000);
    if (!state) {
      await profile.click({ timeout: 5000 });
      state = await read(3000);
    }
    if (state) return result(state);
    await page.keyboard.press('Escape');
  }
  throw new Error(`${market.toUpperCase()} profile is rendered but login/logout actions did not initialize. No login was submitted.`);
}

async function prepareAuthStorefront(page, {
  market, homeUrl, setupUrl, navigate, prepareWindow = prepareAuthBrowserWindow, log = console.log, beforeHome = () => {}, controlTimeoutMs = 60000,
  healthCheck = assertAuthStorefrontHealth,
  fresh = false,
}) {
  const home = new URL(homeUrl);
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || home.protocol !== 'https:' ||
      !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(home.hostname) ||
      home.pathname.replace(/\/$/, '') !== `/${market}`) throw new Error('Auth storefront readiness requires the correct staging market home.');
  const setup = setupUrl ? new URL(setupUrl) : null;
  if (setup && (setup.origin !== home.origin || setup.pathname !== '/getcookie.html')) throw new Error('Auth bootstrap must use getcookie.html on the same staging origin.');
  const report = message => log(`[auth:login:${market}] ${message}`);
  // Newly restored CDP targets can briefly report an empty URL. Treat that as
  // an uninitialized tab, never as a trusted storefront or an auth failure.
  const current = () => { try { return new URL(page.url()); } catch { return new URL('about:blank'); } };
  if (current().hostname === 'account.samsung.com') throw new Error('Samsung Account verification is already open; resume it instead of navigating away.');
  await prepareWindow(page);
  if (!fresh && current().origin === home.origin && current().pathname.replace(/\/$/, '') === `/${market}` && await authProfileControl(page).isVisible()) {
    report('reusing the rendered storefront; checking profile actions');
    return page;
  }
  const blank = async () => {
    const text = (await page.locator('body').innerText({ timeout: 3000 })).trim();
    return !text.replace(/Skip to (?:Header|Main Content|Footer)|Loading\.\.\.|Cargando\.\.\./gi, '').trim();
  };
  const open = async (target, marker, label) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = new URL(target);
      if (attempt) url.searchParams.set('_qa_auth_reload', String(Date.now()));
      report(`${label}${attempt ? ' · recovering a blank document once' : ''}`);
      const response = await navigate(page, url.href, { waitUntil: 'commit', timeout: 30000 });
      if (current().origin !== home.origin) throw new Error(`${market.toUpperCase()} ${label} left the expected staging origin.`);
      if (response && !response.ok()) throw new Error(`${market.toUpperCase()} ${label} returned HTTP ${response.status()}; login was not submitted.`);
      try {
        await marker().waitFor({ state: 'visible', timeout: controlTimeoutMs });
        return;
      } catch (error) {
        if (attempt || page.isClosed() || error.name !== 'TimeoutError' || !(await blank())) {
          if (!page.isClosed()) await healthCheck(page.context().request, {
            market: market.toUpperCase(), environment: home.hostname.startsWith('stg2.') ? 'S2' : 'S1',
          });
          throw new Error(`${market.toUpperCase()} ${label} did not initialize its expected control. Inspect staging availability; no whole-login retry was made.`, { cause: error });
        }
      }
    }
  };
  if (setup) await open(setup, () => page.getByText(/You can access pages now/i).first(), 'preparing staging access');
  await beforeHome();
  await open(home, () => authProfileControl(page), 'loading storefront profile');
  report('storefront profile is ready');
  return page;
}

module.exports = { authProfileControl, authActions, openAuthProfile, prepareAuthStorefront };
