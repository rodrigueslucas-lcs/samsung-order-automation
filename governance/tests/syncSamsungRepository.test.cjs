const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {runSync, sensitiveText, POLICY} = require('../../scripts/sync-samsung-repository.cjs');
const source = 'a'.repeat(40), target = 'b'.repeat(40), blob = 'c'.repeat(40), branch = POLICY.branch;

// Unit-level remote simulation also records EVERY attempted Git operation.
function model() {
  const state = {head: source, origin: source, samsung: target, branch, dirty: false,
    ancestor: true, body: 'safe source\n', filename: 'example.txt', message: 'validated fix',
    calls: [], logs: [], fetches: 0, pushes: 0};
  const git = args => {
    state.calls.push(args);
    const ok = output => ({status: 0, output});
    switch (args[0]) {
      case 'branch': return ok(state.branch);
      case 'status': return ok(state.dirty ? ' M example.txt\0' : '');
      case 'rev-parse': return ok(state.head);
      case 'remote': return ok(state.badRemote ? 'https://unapproved.invalid/repo' : POLICY.remotes[args.at(-1)]);
      case 'config': return {status: 1, output: ''};
      case 'ls-remote': {
        const name = args[3];
        if (state.unavailable === name || state.pushes && state.verifyFailure) return {status: 128, output: ''};
        return ok(state[name] + '\trefs/heads/' + branch + '\n');
      }
      case 'fetch': state.fetches++; return ok('');
      case 'merge-base': return {status: state.ancestor ? 0 : 1, output: ''};
      case 'rev-list': return ok(source + '\n');
      case 'show': return ok(state.message);
      case 'diff-tree': return ok(':100644 100644 ' + target + ' ' + blob + ' M\0' + state.filename + '\0');
      case 'cat-file': return ok(args[1] === '-s' ? String(Buffer.byteLength(state.body)) : state.body);
      case 'push':
        state.pushes++;
        assert.deepEqual(args, ['push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', 'samsung', source + ':refs/heads/' + branch]);
        if (state.pushReject) return {status: 1, output: ''};
        state.samsung = source; return ok('');
      default: throw Error('Unexpected Git mutation');
    }
  };
  return {state, options: {git, log: s => state.logs.push(s)}};
}
test('dry-run inspects history and files without pushing', async () => {
  const m = model(), r = await runSync(m.options);
  assert.equal(r.status, 'DRY_RUN'); assert.deepEqual(r.files, ['example.txt']);
  assert.equal(r.commits[0].sha, source); assert.equal(m.state.pushes, 0);
});
test('publish requires exact SHA and verifies its result', async () => {
  const m = model();
  assert.equal((await runSync({...m.options, publish: true, confirm: async sha => 'PUBLICAR ' + sha})).status, 'SUCCESS');
  assert.equal(m.state.pushes, 1); assert.equal((await runSync(m.options)).status, 'UP_TO_DATE');
});
for (const [property, value, code] of [
  ['dirty', true, 'WORKING_TREE_NOT_CLEAN'], ['branch', 'different', 'WRONG_BRANCH'],
  ['head', target, 'HEAD_NOT_PUBLISHED_ON_ORIGIN'], ['badRemote', true, 'REMOTE_POLICY_MISMATCH'],
  ['unavailable', 'origin', 'REMOTE_ORIGIN_UNAVAILABLE'], ['unavailable', 'samsung', 'REMOTE_SAMSUNG_UNAVAILABLE'],
  ['ancestor', false, 'HISTORY_DIVERGED_OR_TARGET_AHEAD'], ['filename', 'AGENTS.md', 'SENSITIVE_PATH'],
  ['filename', 'cookies.json', 'SENSITIVE_PATH'], ['filename', 'storageState.json', 'SENSITIVE_PATH'],
  ['body', '\0binary', 'BINARY_FILE_REQUIRES_REVIEW'],
]) test('blocks ' + code, async () => {
  const m = model(); m.state[property] = value;
  const r = await runSync({...m.options, publish: true, confirm: async sha => 'PUBLICAR ' + sha});
  assert.equal(r.code, code); assert.equal(m.state.pushes, 0);
  if (property === 'unavailable') assert.equal(m.state.fetches, 0);
  if (value === 'origin') assert.equal(m.state.calls.some(a => a[0] === 'ls-remote' && a[3] === 'samsung'), false);
});
test('secret in an outgoing intermediate commit prevents publication and logging', async () => {
  const m = model(), secret = 'gh' + 'p_' + 'x'.repeat(36); m.state.body = secret;
  assert.equal((await runSync(m.options)).code, 'SENSITIVE_CONTENT');
  assert.equal(m.state.logs.join('\n').includes(secret), false);
});
test('approval is never inferred from yes, short SHA, or absent prompt', async () => {
  for (const answer of ['', 'yes', 'PUBLICAR ' + source.slice(0, 8)]) {
    const m = model();
    assert.equal((await runSync({...m.options, publish: true, confirm: async () => answer})).code, 'OPERATOR_APPROVAL_REQUIRED');
    assert.equal(m.state.pushes, 0);
  }
});
for (const mutate of ['head', 'samsung', 'origin', 'dirty']) test('review mutation invalidates approval: ' + mutate, async () => {
  const m = model();
  const r = await runSync({...m.options, publish: true, confirm: async sha => {
    m.state[mutate] = mutate === 'dirty' ? true : 'd'.repeat(40); return 'PUBLICAR ' + sha;
  }});
  assert.equal(r.status, 'BLOCKED'); assert.equal(m.state.pushes, 0);
});
test('failed push or readback cannot cause automatic retry', async () => {
  for (const flag of ['pushReject', 'verifyFailure']) {
    const m = model(); m.state[flag] = true;
    assert.equal((await runSync({...m.options, publish: true, confirm: async sha => 'PUBLICAR ' + sha})).status, 'UNCONFIRMED');
    assert.equal(m.state.pushes, 1);
  }
});
test('sensitive content detector recognizes credentials and PAN without real fixtures', () => {
  assert.equal(sensitiveText('password=' + '"' + 'temporary-secret' + '"'), true);
  assert.equal(sensitiveText('4111' + '11111111' + '1111'), true);
  assert.equal(sensitiveText(['4111', '1111', '1111', '1111'].join(' ')), true);
  assert.equal(sensitiveText('normal source without credentials'), false);
});

test('real local bare remotes: diagnostic, fast-forward, old-secret history and divergence', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'samsung-sync-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('samsung-sync-test-'));
    fs.rmSync(resolved, {recursive: true, force: true});
  });
  const native = path.join(process.env.ProgramFiles || '', 'Git/mingw64/bin/git.exe');
  const executable = process.platform === 'win32' && fs.existsSync(native) ? native : 'git';
  const work = path.join(root, 'work'); fs.mkdirSync(work);
  const remotes = {origin: path.join(root, 'origin.git').replace(/\\/g, '/'), samsung: path.join(root, 'samsung.git').replace(/\\/g, '/')};
  const execute = (cwd, args) => {
    const r = spawnSync(executable, args, {cwd, encoding: 'utf8', windowsHide: true, timeout: 120000,
      env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
    return {status: r.status, output: r.stdout || ''};
  };
  const must = (cwd, args) => { const r = execute(cwd, args); assert.equal(r.status, 0, 'Local Git fixture operation must succeed'); return r.output.trim(); };
  for (const remote of Object.values(remotes)) must(root, ['init', '--bare', remote]);
  must(work, ['init', '-b', branch]);
  const commit = (name, body) => {
    fs.writeFileSync(path.join(work, name), body); must(work, ['add', '--', name]);
    must(work, ['-c', 'user.name=Local Sync Test', '-c', 'user.email=sync@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'local fixture']);
    return must(work, ['rev-parse', 'HEAD']);
  };
  const baseline = commit('example.txt', 'baseline\n');
  for (const [name, remote] of Object.entries(remotes)) { must(work, ['remote', 'add', name, remote]); must(work, ['push', name, branch]); }
  const next = commit('example.txt', 'validated update\n'); must(work, ['push', 'origin', branch]);
  const opts = {cwd: work, policy: {branch, remotes}, git: args => execute(work, args), log: () => {}};
  const targetSha = () => must(root, ['--git-dir=' + remotes.samsung, 'rev-parse', 'refs/heads/' + branch]);
  assert.equal((await runSync(opts)).status, 'DRY_RUN'); assert.equal(targetSha(), baseline);
  assert.equal((await runSync({...opts, publish: true, confirm: async sha => 'PUBLICAR ' + sha})).status, 'SUCCESS');
  assert.equal(targetSha(), next);
  const secret = 'gh' + 'p_' + 'x'.repeat(36);
  commit('temporary.txt', secret); commit('temporary.txt', 'removed\n'); must(work, ['push', 'origin', branch]);
  assert.equal((await runSync(opts)).code, 'SENSITIVE_CONTENT'); assert.equal(targetSha(), next);
  must(work, ['checkout', '-b', 'corporate-change', next]); const corporate = commit('corporate.txt', 'corporate update\n');
  must(work, ['push', 'samsung', 'HEAD:refs/heads/' + branch]); must(work, ['checkout', branch]);
  assert.equal((await runSync(opts)).status, 'DIVERGED'); assert.equal(targetSha(), corporate);
});
test('--help works outside a repository without contacting remotes', () => {
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts/sync-samsung-repository.cjs'), '--help'], {cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true});
  assert.equal(r.status, 0); assert.match(r.stdout, /Default: diagnostic only/);
});
