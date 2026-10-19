const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function bootstrapScenario({ failures = 1, body = '', url = 'https://stg2.shop.samsung.com/cl/' } = {}) {
  let waits = 0, reloads = 0;
  const profile = { or() { return this; }, filter() { return this; }, first() { return this; },
    async waitFor() { if (++waits <= failures) throw new Error('header unavailable'); } };
  const empty = { count: async () => 1, innerText: async () => '' };
  const page = { goto: async () => {}, url: () => url,
    reload: async () => { reloads++; },
    getByRole: role => role === 'button' ? profile : empty,
    locator: selector => selector === 'body' ? { innerText: async () => body } : profile };
  const source = fs.readFileSync('flows/cl/qstFlows.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const run = vm.runInNewContext(`${source}\nbootstrapClStorefront;`, {
    URL, test: { step: (_, action) => action() }, clAuthStateModule: {},
    clStorefrontOverlays: { installClChatNoticeDismissal: async () => {} },
  });
  return { run: () => run(page, { baseUrl: new URL('https://stg2.shop.samsung.com/cl/') }),
    counts: () => ({ waits, reloads }) };
}

test('CL recovers one empty home shell before business mutations', async () => {
  const s = bootstrapScenario({ body: 'Skip to Header Skip to Main Content Skip to Footer' });
  await s.run(); assert.deepEqual(s.counts(), { waits: 2, reloads: 1 });
});
test('CL does not reload login/error/content pages or a foreign origin', async () => {
  for (const options of [{ body: 'Authentication required' }, { body: 'Server error' },
    { url: 'https://www.samsung.com/cl/' }, { url: 'https://stg2.shop.samsung.com/cl/login' }]) {
    const s = bootstrapScenario(options); await assert.rejects(s.run(), /header unavailable/);
    assert.equal(s.counts().reloads, 0);
  }
});
test('CL propagates a repeated blank shell without an unbounded refresh loop', async () => {
  const s = bootstrapScenario({ failures: 2 }); await assert.rejects(s.run(), /header unavailable/);
  assert.deepEqual(s.counts(), { waits: 2, reloads: 1 });
});

const profileSource = fs.readFileSync('pages/ProfilePage.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
function addressScenario({ status = 201, interrupted = false } = {}) {
  const events = []; let predicate, resolve;
  const Profile = vm.runInNewContext(`${profileSource}\nProfilePage;`, {
    URL, process, MyAccountPage: class {},
    expect: () => ({ toBeHidden: async () => events.push('modal-hidden') }),
  });
  const profile = Object.create(Profile.prototype);
  profile.origin = 'https://stg2.shop.samsung.com'; profile.market = 'cl';
  profile.page = { waitForResponse: (check, options) => {
    predicate = check; assert.equal(options.timeout, 120000);
    return new Promise(r => { resolve = r; });
  } };
  const response = (host = 's2-smb-api-cdn.ecom-stg.samsung.com', market = 'cl', method = 'POST') => ({
    url: () => `https://${host}/tokocommercewebservices/v2/${market}/users/current/addresses`,
    request: () => ({ method: () => method }), ok: () => status < 400, status: () => status,
    finished: async () => { events.push('body-finished'); return interrupted ? new Error('interrupted') : null; },
  });
  const save = { click: async () => {
    events.push('save-once');
    assert.equal(predicate(response('s1-smb-api-cdn.ecom-stg.samsung.com')), false);
    assert.equal(predicate(response(undefined, 'pe')), false);
    assert.equal(predicate(response(undefined, 'cl', 'GET')), false);
    assert.equal(predicate(response()), true); resolve(response());
  } };
  return { run: () => profile.saveClQaAddress(save, {}), events };
}
test('CL waits for the exact environment save body before checking the modal', async () => {
  const s = addressScenario(); await s.run();
  assert.deepEqual(s.events, ['save-once', 'body-finished', 'modal-hidden']);
});
test('CL save errors propagate without a second submission or false UI success', async () => {
  for (const options of [{ status: 500 }, { interrupted: true }]) {
    const s = addressScenario(options); await assert.rejects(s.run(), /no automatic resubmit/);
    assert.equal(s.events.filter(e => e === 'save-once').length, 1);
    assert.equal(s.events.includes('modal-hidden'), false);
  }
});
