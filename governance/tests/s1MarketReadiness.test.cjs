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
