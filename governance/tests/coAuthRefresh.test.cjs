const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../scripts/auth-refresh-co.cjs'), 'utf8');
function refresh(env) {
  const calls = [];
  vm.runInNewContext(source, {
    process: { env, execPath: 'fixture-node' },
    require: () => ({ spawnSync: (_, args, options) => { calls.push({ script: args[0], env: options.env }); return { status: 0 }; } }),
    console: { log() {}, warn() {} },
    Atomics: { wait() {} },
  });
  return calls;
}
test('CO refresh resolves MX second-slot alias consistently across login, verify and package', () => {
  const calls = refresh({ CO_QST_ENVIRONMENT: 'S1', MX_AUTH_SLOT: 'second' });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.env.CO_AUTH_SLOT, 'second');
    assert.equal(call.env.CO_AUTH_MANUAL, '1');
    assert.equal(call.env.CO_QST_ENVIRONMENT, 'S1');
  }
});
test('CO refresh rejects conflicting account slots before any auth operation', () => {
  assert.throws(() => refresh({ CO_AUTH_SLOT: 'primary', MX_AUTH_SLOT: 'second' }), /Conflicting auth slots/);
});
