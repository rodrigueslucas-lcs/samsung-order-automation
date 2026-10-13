const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../scripts/auth-refresh-cl.cjs"), "utf8");
function refresh(statuses) {
  const calls = [];
  const output = [];
  const process = { env: { CL_QST_ENVIRONMENT: "S2" }, execPath: "fixture-node", exitCode: 0 };
  vm.runInNewContext(source, {
    process,
    require: name => {
      assert.equal(name, "node:child_process");
      return { spawnSync: (_, args) => { calls.push(args[0]); return { status: statuses.shift() }; } };
    },
    console: { log: text => output.push(text), warn: text => output.push(text), error: text => output.push(text) },
    Atomics: { wait: () => 0 },
  });
  return { calls, output: output.join("\n"), exitCode: process.exitCode };
}

test("CL refresh emits READY only after login, verification and packaging succeed", () => {
  const result = refresh([0, 0, 0]);
  assert.deepEqual(result.calls, ["scripts/auth-login-cl.cjs", "scripts/auth-verify-cl.cjs", "scripts/auth-package-cl.cjs"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /READY/);
});

for (const [status, reason] of [[73, /profile is occupied/], [78, /prerequisite failed/]]) {
  test(`CL refresh stops once for non-retryable exit ${status}, without stack trace or false READY`, () => {
    const result = refresh([status]);
    assert.equal(result.calls.length, 1);
    assert.equal(result.exitCode, 1);
    assert.match(result.output, reason);
    assert.doesNotMatch(result.output, /READY|at run \(|retrying in/);
  });
}

test("CL refresh does not package or emit READY when verification fails", () => {
  const result = refresh([0, 1]);
  assert.equal(result.calls.length, 2);
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(result.output, /READY|Packaging/);
});
