const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function scenario(status) {
  const source = fs.readFileSync('tests/markets/mx/qst/base-store/mxQstFlows.js', 'utf8');
  const body = source.slice(source.indexOf('export async function openMxQstPdp'), source.indexOf('export async function prepareMxQstCart'))
    .replace('export async function', 'async function');
  let release, predicate, settled = false, validated = false;
  const response = { status: () => status };
  const pending = new Promise(resolve => { release = resolve; });
  const page = {
    waitForResponse: check => { predicate = check; return pending.then(value => { settled = true; return value; }); },
    goto: async () => {
      assert.equal(typeof predicate, 'function', 'Register the product response before navigating.');
      // Model the API completing after navigation, before the SKU can render.
      Promise.resolve().then(() => release(response));
    },
    getByText: () => ({ first: () => 'sku' }),
  };
  const expect = value => ({
    toBe: expected => assert.equal(value, expected),
    toHaveURL: async () => assert.equal(settled, true),
    toBeVisible: async () => { assert.equal(settled, true); validated = true; },
  });
  const open = vm.runInNewContext(`${body}\nopenMxQstPdp;`, {
    URL, expect, bootstrapMx: async () => {}, test: { step: async (_, fn) => fn() },
  });
  return { run: () => open(page, { sku: 'SM-F741BLBKLTM', pdpUrl: 'https://stg2.shop.samsung.com/mx/p/SM-F741BLBKLTM' }),
    predicate: () => predicate, validated: () => validated };
}

test('MX PDP waits for the actual product response before DOM assertions without premature reload', async () => {
  const s = scenario(200);
  await s.run();
  assert.equal(s.validated(), true);
  const response = (path, method = 'GET') => ({ url: () => `https://s2-api-cdn.ecom-stg.samsung.com${path}`, request: () => ({ method: () => method }) });
  assert.equal(s.predicate()(response('/tokocommercewebservices/v2/mx/products/SM-F741BLBKLTM')), true);
  assert.equal(s.predicate()(response('/tokocommercewebservices/v2/mx/products/SM-F741BLBKLTM/getProductBenefits')), false);
  assert.equal(s.predicate()(response('/tokocommercewebservices/v2/co/products/SM-F741BLBKLTM')), false);
});

test('MX PDP rejects an unsuccessful product response instead of accepting an empty page', async () => {
  const s = scenario(404);
  await assert.rejects(s.run());
  assert.equal(s.validated(), false);
});
