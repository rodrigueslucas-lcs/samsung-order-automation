const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../pages/CheckoutPage.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class CheckoutPage', 'class CheckoutPage');
const CheckoutPage = vm.runInNewContext(`${source}\nCheckoutPage;`, { BasePage: class {} });

function scenario({ direct = false, disappear = false, clickFails = false, checked = true, headingVisible = true } = {}) {
  let radioVisible = !direct;
  let formVisible = direct;
  let clicks = 0;
  const failure = new Error('Radio click failed');
  const form = {
    filter() { return this; },
    first() { return this; },
    isVisible: async () => formVisible,
    waitFor: async () => { assert.equal(formVisible, true, 'new-address form must actually be ready'); },
  };
  const radio = {
    isVisible: async () => radioVisible,
    isChecked: async () => checked,
    or: () => ({ first: () => ({ waitFor: async () => {} }) }),
    locator: () => ({ click: async () => {
      clicks += 1;
      if (disappear) { radioVisible = false; formVisible = true; throw failure; }
      if (clickFails) throw failure;
      formVisible = checked;
    } }),
  };
  const panel = { waitFor: async () => {}, getByRole: role => {
    if (role === 'radio') return radio;
    if (role === 'heading') return { isVisible: async () => headingVisible, waitFor: async () => {} };
    assert.equal(role, 'combobox');
    return form;
  } };
  const checkout = Object.create(CheckoutPage.prototype);
  checkout.page = { getByRole: () => panel };
  return { run: () => checkout.selectNewAuthenticatedAddress(), clicks: () => clicks, failure };
}

test('PE direct address form needs no obsolete radio click', async () => {
  const s = scenario({ direct: true });
  await s.run();
  assert.equal(s.clicks(), 0);
});

test('PE addresses loading can replace the radio with a ready direct form during click', async () => {
  const s = scenario({ disappear: true });
  await s.run();
  assert.equal(s.clicks(), 1);
});

test('PE still selects the new-address radio when saved-address mode remains', async () => {
  const s = scenario();
  await s.run();
  assert.equal(s.clicks(), 1);
});

test('PE shared address heading does not count as an editable new-address form', async () => {
  const s = scenario({ headingVisible: true });
  await s.run();
  assert.equal(s.clicks(), 1, 'saved mode must switch even when its section heading is visible');
});

test('PE does not swallow an unrelated click failure', async () => {
  const s = scenario({ clickFails: true });
  await assert.rejects(s.run(), error => error === s.failure);
});

test('PE does not accept a radio that failed to stay selected', async () => {
  const s = scenario({ checked: false });
  await assert.rejects(s.run(), /did not remain selected/);
});
