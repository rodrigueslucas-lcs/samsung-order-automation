const test = require('node:test');
const assert = require('node:assert/strict');

const { getMxConfig } = require('../../utils/mxConfig');
const { getPeQstConfig } = require('../../config/markets/pe');
const { getCoQstConfig } = require('../../config/markets/co');
const { getClQstConfig } = require('../../config/markets/cl');

const CASES = [
  ['MX', getMxConfig, { MX_QST_ENVIRONMENT: 'S1' }, '/mx/'],
  ['PE', getPeQstConfig, { PE_QST_ENVIRONMENT: 'S1' }, '/pe/'],
  ['CO', getCoQstConfig, { CO_QST_ENVIRONMENT: 'S1' }, '/co/'],
  ['CL', getClQstConfig, { CL_QST_ENVIRONMENT: 'S1' }, '/cl/'],
];

for (const [market, factory, environment, routePrefix] of CASES) {
  test(`${market} S1 Base Store config is runnable without S2-only defaults`, () => {
    const config = factory(environment);

    assert.equal(config.environment, 'S1');
    assert.match(config.environmentLabel, /S1\/STG/);
    assert.equal(config.baseUrl.hostname, 'stg.shop.samsung.com');
    assert.ok(config.baseUrl.pathname.startsWith(routePrefix));
    assert.ok(String(config.sku || '').trim(), `${market} S1 must expose a default SKU`);
    assert.ok(config.pdpUrl, `${market} S1 must expose a default PDP URL`);
    assert.equal(config.pdpUrl.hostname, config.baseUrl.hostname);
    assert.ok(config.pdpUrl.pathname.startsWith(routePrefix));
    assert.equal(config.cartUrl.hostname, config.baseUrl.hostname);
    assert.ok(config.cartUrl.pathname.startsWith(routePrefix));
  });
}

test('CO staging bootstrap applies to both environments and rejects cross-origin overrides', () => {
  for (const environment of ['S1', 'S2']) {
    const config = getCoQstConfig({ CO_QST_ENVIRONMENT: environment });
    assert.equal(config.setupUrl.href, new URL('/getcookie.html', config.baseUrl.origin).href);
  }
  assert.throws(() => getCoQstConfig({ CO_QST_ENVIRONMENT: 'S1', CO_SETUP_URL: 'https://other.example.test/getcookie.html' }), /storefront origin/);
});

test('CL staging bootstrap applies to both environments and rejects unsafe overrides', () => {
  for (const environment of ['S1', 'S2']) {
    const config = getClQstConfig({ CL_QST_ENVIRONMENT: environment });
    assert.equal(config.setupUrl.href, new URL('/getcookie.html', config.baseUrl.origin).href);
    assert.equal(config.checkoutCommune, 'Alhué');
    const custom = getClQstConfig({ CL_QST_ENVIRONMENT: environment, CL_SETUP_URL: `${config.baseUrl.origin}/getcookie.html` });
    assert.equal(custom.setupUrl.origin, custom.baseUrl.origin);
    assert.equal(getClQstConfig({ CL_QST_ENVIRONMENT: environment, CL_QST_COMMUNE: 'Providencia' }).checkoutCommune, 'Providencia');
  }
  assert.throws(() => getClQstConfig({ CL_QST_ENVIRONMENT: 'S1', CL_SETUP_URL: 'https://other.example.test/getcookie.html' }), /storefront origin/);
  assert.throws(() => getClQstConfig({ CL_QST_ENVIRONMENT: 'S1', CL_SETUP_URL: 'http://stg.shop.samsung.com/getcookie.html' }), /https/);
  assert.throws(() => getClQstConfig({ CL_QST_ENVIRONMENT: 'S1', CL_QST_COMMUNE: ' ' }), /must not be empty/);
});
