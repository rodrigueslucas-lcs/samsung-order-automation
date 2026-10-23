const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const market of ['pe', 'co']) for (const environment of ['S1', 'S2']) {
  test(`${market} ${environment} export retains its actual staging API cookie and rejects foreign origins`, async () => {
    const source = fs.readFileSync(`scripts/auth-login-${market}.cjs`, 'utf8');
    const begin = source.indexOf('async function exportAuthenticatedState(');
    const end = source.indexOf(`async function ${market === 'pe' ? 'loginPeSamsungAccount' : 'findAuthenticatedPreQaCoPage'}(`, begin);
    const declaration = source.match(/const API_HOSTNAME =[\s\S]*?;/)[0];
    const hostname = environment === 'S2' ? 'stg2.shop.samsung.com' : 'stg.shop.samsung.com';
    const api = `${environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
    const saved = {};
    const exportState = vm.runInNewContext(`${declaration}\n${source.slice(begin, end)}\nexportAuthenticatedState`, {
      CONFIG: { environment }, HOSTNAME: hostname, ENV_NAME: environment, ENV_SUFFIX: environment.toLowerCase(),
      authDir: '/fixture', authFile: 'state', sessionStorageFile: 'storage',
      fs: { mkdirSync() {} }, URL, writeJsonSecurely: (file, value) => { saved[file] = value; },
    });
    const cookies = [{ name: 'storefront', domain: hostname }, { name: 'api', domain: api },
      { name: 'foreign', domain: 'shop.samsung.com' }, { name: 'another-env', domain: `${environment === 'S1' ? 's2' : 's1'}-smb-api-cdn.ecom-stg.samsung.com` }];
    await exportState({ storageState: async () => ({ cookies, origins: [{ origin: `https://${hostname}` }, { origin: 'https://shop.samsung.com' }] }) }, { evaluate: async () => ({}) });
    assert.deepEqual(Array.from(saved.state.cookies, x => x.name), ['storefront', 'api']);
    assert.deepEqual(Array.from(saved.state.origins, x => x.origin), [`https://${hostname}`]);
  });
}
