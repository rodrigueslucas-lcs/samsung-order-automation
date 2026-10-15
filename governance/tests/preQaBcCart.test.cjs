const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function guardedFlow() {
  const source = fs.readFileSync('flows/smb/preQaBcCart.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function');
  return vm.runInNewContext(`${source}\naddProductFromPreQaBc;`, {
    URL, chromium: { connectOverCDP() { assert.fail('Rejected BC selection must not open a browser'); } },
  });
}

test('BC refuses Production, foreign markets and insecure URLs before opening any browser', async () => {
  const addProductFromPreQaBc = guardedFlow();
  for (const plpPath of ['https://www.samsung.com/co/refrigerators/', 'https://p6-pre-qa2.samsung.com/pe/refrigerators/', 'http://p6-pre-qa2.samsung.com/co/refrigerators/']) {
    await assert.rejects(addProductFromPreQaBc({ market: 'co', sku: 'RF32CG5910B1CO', plpPath }), /authenticated PreQA origin/);
  }
});

test('BC rejects malformed market and model selections before any CDP connection', async () => {
  const addProductFromPreQaBc = guardedFlow();
  for (const overrides of [{ market: '../co' }, { sku: 'invalid"model' }]) {
    await assert.rejects(addProductFromPreQaBc({ market: 'co', sku: 'RF32CG5910B1CO', plpPath: '/co/refrigerators/', ...overrides }), /Invalid BC market or model/);
  }
});
