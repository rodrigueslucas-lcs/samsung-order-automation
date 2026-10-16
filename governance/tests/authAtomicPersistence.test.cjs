const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function writerWithLock(failures, code = 'EBUSY') {
  let calls = 0;
  let current = 'previous-valid-state';
  const removed = [];
  const temporary = [];
  const fakeFs = {
    openSync(file, flags, mode) { temporary.push(file); assert.equal(mode, 0o600); return 1; },
    writeFileSync() {}, fsyncSync() {}, closeSync() {}, chmodSync() {},
    renameSync(from, to) {
      calls++;
      if (calls <= failures) throw Object.assign(new Error('locked'), { code });
      current = 'new-valid-state';
    },
    rmSync(file) { removed.push(file); },
  };
  const sandbox = { module: { exports: {} }, require: () => fakeFs, process: { pid: 123 },
    SharedArrayBuffer, Int32Array, Atomics: { wait() {} }, Date };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'utils/atomicJson.js'), 'utf8'), sandbox);
  return { write: sandbox.module.exports.writeJsonAtomically, state: () => ({ calls, current, removed, temporary }) };
}

for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
  test(`auth persistence retries temporary Windows ${code} without deleting valid state`, () => {
    const writer = writerWithLock(2, code);
    writer.write('session.json', { fixture: true });
    const state = writer.state();
    assert.equal(state.calls, 3);
    assert.equal(state.current, 'new-valid-state');
    assert.match(state.temporary[0], /session\.json\.tmp-123-\d+$/);
    assert.deepEqual(state.removed, state.temporary);
  });
}

test('persistent lock fails boundedly and preserves existing session', () => {
  const writer = writerWithLock(99);
  assert.throws(() => writer.write('session.json', {}), { code: 'EBUSY' });
  const state = writer.state();
  assert.equal(state.calls, 7);
  assert.equal(state.current, 'previous-valid-state');
  assert.deepEqual(state.removed, state.temporary);
});

test('all market auth entrypoints use shared atomic persistence', () => {
  const files = fs.readdirSync(path.join(root, 'scripts')).filter(name =>
    /^auth-(verify|login|bootstrap|package|install)/.test(name) && name.endsWith('.cjs'));
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, 'scripts', file), 'utf8');
    assert.doesNotMatch(source, /fs\.renameSync\(/, `${file}: bypasses Windows lock retry`);
    assert.doesNotMatch(source, /storageState\(\{\s*path:/, `${file}: writes session directly`);
  }
});
