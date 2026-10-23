const test = require("node:test");
const assert = require("node:assert/strict");
const { runRefreshFixture } = require("../fixtures/authRefreshHarness.cjs");
const refresh = statuses => runRefreshFixture("cl", { CL_QST_ENVIRONMENT: "S2" }, statuses).then(result => ({ ...result, calls: result.calls.map(call => call.script) }));

test("CL refresh emits READY only after login, verification and packaging succeed", async () => {
  const result = await refresh([0, 0, 0]);
  assert.deepEqual(result.calls, ["scripts/auth-login-cl.cjs", "scripts/auth-verify-cl.cjs", "scripts/auth-package-cl.cjs"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /READY/);
});

for (const [status, reason] of [[73, /profile is occupied/], [78, /prerequisite failed/]]) {
  test(`CL refresh stops once for non-retryable exit ${status}, without stack trace or false READY`, async () => {
    const result = await refresh([status]);
    assert.equal(result.calls.length, 1);
    assert.equal(result.exitCode, 1);
    assert.match(result.output, reason);
    assert.doesNotMatch(result.output, /READY|at run \(|retrying in/);
  });
}

test("CL refresh does not package or emit READY when verification fails", async () => {
  const result = await refresh([0, 1]);
  assert.equal(result.calls.length, 2);
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(result.output, /READY|Packaging/);
});
