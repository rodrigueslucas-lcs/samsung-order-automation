const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { prepareAuthStorefront, openAuthProfile } = require('../../utils/authStorefrontReady.cjs');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

function homeHtml({ signedIn = false, clickOnly = false } = {}) {
  const reveal = "document.querySelector('nav').hidden=false";
  return `<html><body><button data-an-la="L0_13_login" aria-label="Perfil" ${clickOnly ? '' : `onmouseover="${reveal}"`} onclick="${reveal}">Profile</button>
    <nav hidden>${signedIn ? '<button>Cerrar sesión</button>' : '<div>Iniciar sesión/Registrarse</div><a class="loginBtn" data-an-la="login" href="https://account.samsung.com/accounts/fixture">Beneficios exclusivos con una Samsung Account</a>'}</nav><main>Storefront</main></body></html>`;
}

async function fixture(market = 'mx', environment = 'S2', { blankFirst = false, broken = false, http = 200, signedIn = false, clickOnly = false } = {}) {
  const context = await browser.newContext(); const page = await context.newPage();
  const origin = environment === 'S2' ? 'https://stg2.shop.samsung.com' : 'https://stg.shop.samsung.com';
  let homes = 0, setups = 0;
  await context.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/getcookie.html') { setups++; return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<html><body>You can access pages now!</body></html>' }); }
    homes++;
    const body = broken ? '<html><body>System Check: staging unavailable</body></html>' : blankFirst && homes === 1 ? '<html><body><main></main></body></html>' : homeHtml({ signedIn, clickOnly });
    return route.fulfill({ status: http, contentType: 'text/html; charset=utf-8', body });
  });
  await context.route('https://account.samsung.com/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<html><body>Human verification fixture</body></html>' }));
  const options = { market, setupUrl: `${origin}/getcookie.html`, homeUrl: `${origin}/${market}/`,
    navigate: (page, url, options) => page.goto(url, options), prepareWindow: async () => {}, log() {}, healthCheck: async () => {}, controlTimeoutMs: 1500 };
  return { page, options, close: () => context.close(), counts: () => ({ homes, setups }) };
}

for (const market of ['mx', 'pe', 'co', 'cl']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} native profile fallback reaches Account on first login handoff`, async () => {
    const s = await fixture(market, environment, { clickOnly: market === 'co' });
    try {
      await prepareAuthStorefront(s.page, s.options);
      const state = await openAuthProfile(s.page, s.options);
      assert.equal(state.state, 'signed-out');
      await Promise.all([s.page.waitForURL('https://account.samsung.com/**'), state.login.click()]);
      assert.equal(new URL(s.page.url()).hostname, 'account.samsung.com');
      assert.deepEqual(s.counts(), { homes: 1, setups: 1 });
    } finally { await s.close(); }
  });
}

test('blank document recovery repeats only a safe storefront GET once', async () => {
  const s = await fixture('mx', 'S2', { blankFirst: true });
  try { await prepareAuthStorefront(s.page, s.options); assert.deepEqual(s.counts(), { homes: 2, setups: 1 }); }
  finally { await s.close(); }
});

test('late Angular My Profile control is awaited without repeating home or login', async () => {
  const s = await fixture('cl', 'S2');
  const navigate = s.options.navigate;
  s.options.navigate = async (page, url, options) => {
    const response = await navigate(page, url, options);
    if (new URL(url).pathname === '/cl/') {
      await page.evaluate(() => {
        const profile = document.querySelector('button[data-an-la="L0_13_login"]');
        profile.setAttribute('data-an-la', 'L0_14_login');
        profile.setAttribute('aria-label', 'My Profile');
        profile.hidden = true;
        setTimeout(() => { profile.hidden = false; }, 250);
      });
    }
    return response;
  };
  try {
    await prepareAuthStorefront(s.page, s.options);
    assert.equal((await openAuthProfile(s.page, s.options)).state, 'signed-out');
    assert.deepEqual(s.counts(), { homes: 1, setups: 1 });
  } finally { await s.close(); }
});

test('rendered System Check and HTTP errors are not blindly retried as blank', async () => {
  for (const options of [{ broken: true }, { http: 503 }]) {
    const s = await fixture('pe', 'S1', options);
    try { await assert.rejects(prepareAuthStorefront(s.page, s.options)); assert.equal(s.counts().homes, 1); }
    finally { await s.close(); }
  }
});

test('already rendered storefront is reused and an open authenticated menu is not toggled closed', async () => {
  const s = await fixture('cl', 'S2', { signedIn: true });
  try {
    await prepareAuthStorefront(s.page, s.options);
    assert.equal((await openAuthProfile(s.page, s.options)).state, 'authenticated');
    await s.page.getByRole('button', { name: 'Perfil' }).evaluate(element => { element.onclick = () => { throw Error('must not toggle'); }; });
    assert.equal((await openAuthProfile(s.page, s.options)).state, 'authenticated');
    await prepareAuthStorefront(s.page, s.options);
    assert.deepEqual(s.counts(), { homes: 1, setups: 1 });
  } finally { await s.close(); }
});

test('an existing Account verification is preserved instead of returning to bootstrap', async () => {
  const s = await fixture();
  try {
    await s.page.goto('https://account.samsung.com/accounts/fixture');
    await assert.rejects(prepareAuthStorefront(s.page, s.options), /verification is already open/);
    assert.equal(new URL(s.page.url()).hostname, 'account.samsung.com');
    assert.deepEqual(s.counts(), { homes: 0, setups: 0 });
  } finally { await s.close(); }
});

test('an explicit new refresh reinitializes home once instead of trusting a stale authenticated DOM', async () => {
  const s = await fixture('mx', 'S2', { signedIn: true });
  try {
    await prepareAuthStorefront(s.page, s.options);
    await prepareAuthStorefront(s.page, { ...s.options, fresh: true });
    assert.deepEqual(s.counts(), { homes: 2, setups: 2 });
  } finally { await s.close(); }
});

test('bootstrap cannot escape the configured staging market or reach production', async () => {
  const s = await fixture();
  try {
    await assert.rejects(prepareAuthStorefront(s.page, { ...s.options, homeUrl: 'https://shop.samsung.com/mx/' }), /staging market home/);
    await assert.rejects(prepareAuthStorefront(s.page, { ...s.options, setupUrl: 'https://stg.shop.samsung.com/getcookie.html' }), /same staging origin/);
    assert.deepEqual(s.counts(), { homes: 0, setups: 0 });
  } finally { await s.close(); }
});

test('a newly restored CDP tab with an empty URL initializes through the trusted bootstrap', async () => {
  const s = await fixture('co', 'S2');
  const original = s.page.url.bind(s.page);
  s.page.url = () => '';
  s.options.navigate = (page, url, options) => { s.page.url = original; return page.goto(url, options); };
  try { await prepareAuthStorefront(s.page, s.options); assert.deepEqual(s.counts(), { homes: 1, setups: 1 }); }
  finally { s.page.url = original; await s.close(); }
});
