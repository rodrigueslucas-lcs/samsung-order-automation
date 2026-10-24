const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('playwright.config.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default defineConfig(', 'const configuration = defineConfig(');
function config(env) {
  return vm.runInNewContext(`${source}\nconfiguration`, {
    process: { env }, devices: { 'Desktop Chrome': {} },
    mxQstScope: { MX_BASE_P1_IDS: [] }, defineConfig: value => value,
  });
}
for (const video of ['0', '1']) {
  test(`CO P1 keeps Chrome and the requested video setting (${video})`, () => {
    const result = config({ TEST_MARKET: 'CO', TEST_SUITE: 'P1/QST', PW_VIDEO: video });
    assert.equal(result.use.channel, 'chrome');
    assert.equal(result.timeout,120000);
    assert.equal(result.use.video === 'off', video === '0');
  });
}
test('other market browser selection is preserved', () => {
  for (const market of ['MX', 'PE', 'CL']) {
    assert.equal(config({ TEST_MARKET: market, PW_VIDEO: '1' }).use.channel, undefined);
    assert.equal(config({ TEST_MARKET: market, PW_VIDEO: '1' }).timeout,30000);
    assert.equal(config({ TEST_MARKET: market, PW_VIDEO: '0' }).use.channel, 'chrome');
  }
});
