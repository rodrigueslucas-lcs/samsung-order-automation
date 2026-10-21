const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file, name, globals) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace(/^export default /gm, '');
  return vm.runInNewContext(`${source}\n${name}`, globals);
}

test('Products navigation completes its AU before accessing the replacement search toolbar', async () => {
  const events = [];
  let ready = false;
  const row = { filter() { return this; }, first() { return this; },
    waitFor: async () => {}, isVisible: async () => true,
    click: async () => events.push('navigate') };
  const Catalog = load('pages/BackOfficeCatalogPage.js', 'BackOfficeCatalogPage',
    { BackOfficePage: class {}, expect: {} });
  const catalog = Object.create(Catalog.prototype);
  catalog.page = { getByRole: () => row, getByPlaceholder: () => ({
    filter() { return this; }, last() { assert.equal(ready, true); return this; },
    waitFor: async () => events.push('toolbar') }) };
  catalog.waitForZkUpdate = async action => { await action(); ready = true; events.push('AU-complete'); };
  await catalog.openAdminProducts();
  assert.deepEqual(events, ['navigate', 'AU-complete', 'toolbar']);
});

test('CL address paging awaits initial cards and growth after every click', async () => {
  let cards = 0, clicks = 0, pending = false;
  const Profile = load('pages/ProfilePage.js', 'ProfilePage', { MyAccountPage: class {}, process,
    expect: { poll: read => ({ toBeGreaterThan: async before => {
      assert.equal(pending, true); cards += 3; pending = false;
      assert.ok(await read() > before);
    } }) } });
  const profile = Object.create(Profile.prototype);
  profile.addressCards = { first: () => ({ waitFor: async () => { cards = 3; } }), count: async () => cards };
  const more = { filter() { return this; }, first() { return this; }, isVisible: async () => true,
    click: async () => { assert.equal(pending, false); pending = true; clicks++; } };
  profile.page = { getByText: () => ({ first: () => ({ isVisible: async () => cards >= 9 }) }), getByRole: () => more };
  await profile.expandClAddressesUntil('QA AUTOMATION marker');
  assert.equal(clicks, 2);
  assert.equal(pending, false);
});
