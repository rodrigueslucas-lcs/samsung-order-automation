const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMxBcCareChoice } = require('../../utils/mxBcCareChoice.cjs');

function fixture({ care = false, enabled = false, afterSelect = true } = {}) {
  let selected = 0;
  const enabledAdd = { waitFor: async () => { if (!enabled) throw Error('exact SKU CTA is disabled'); } };
  const noCare = { isVisible: async () => care, or: other => { assert.equal(other, enabledAdd); return { first: () => ({ waitFor: async () => {
    if (!care && !enabled) throw Error('neither offered Care+ nor exact SKU purchase readiness');
  } }) }; } };
  return { options: { noCare, enabledAdd, selectOptOut: async () => { selected++; enabled = afterSelect; } }, selected: () => selected };
}

test('absent optional Care+ accepts only the exact enabled SKU without clicking a nonexistent choice', async () => {
  const f = fixture({ enabled: true });
  assert.deepEqual(await resolveMxBcCareChoice(f.options), { careProtectionOffered: false, careProtectionDeclined: false });
  assert.equal(f.selected(), 0);
});
test('offered Care+ must be declined even if an enabled CTA also exists', async () => {
  const f = fixture({ care: true, enabled: true });
  assert.deepEqual(await resolveMxBcCareChoice(f.options), { careProtectionOffered: true, careProtectionDeclined: true });
  assert.equal(f.selected(), 1);
});
test('a missing choice cannot bypass a disabled or wrong SKU purchase CTA', async () => {
  const f = fixture(); await assert.rejects(resolveMxBcCareChoice(f.options), /readiness/); assert.equal(f.selected(), 0);
});
test('declining a rendered option still requires an enabled SKU CTA', async () => {
  const f = fixture({ care: true, afterSelect: false }); await assert.rejects(resolveMxBcCareChoice(f.options), /disabled/);
});
