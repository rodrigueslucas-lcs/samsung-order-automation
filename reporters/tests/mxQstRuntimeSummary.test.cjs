const assert = require("node:assert/strict");
const test = require("node:test");
const { buildMxQstRuntimeSummary, safeArtifact } = require("../../utils/mxQstRuntimeSummary.cjs");

test("runtime summary reconciles all canonical statuses", () => {
  const report = { suites: [{ specs: [
    { title: "SAM-1 works", file: "tests/a.spec.js", tests: [{ results: [{ status: "passed", duration: 10, attachments: [] }] }] },
    { title: "SAM-2 fails", file: "tests/b.spec.js", tests: [{ results: [{ status: "failed", duration: 20, errors: [{ message: "assertion" }] }] }] },
    { title: "SAM-3 blocked", file: "tests/c.spec.js", tests: [{ annotations: [{ description: "environment prerequisite" }], results: [{ status: "skipped", duration: 0 }] }] },
  ] }] };
  const value = buildMxQstRuntimeSummary(report, { officialIds: ["SAM-1", "SAM-2", "SAM-3", "SAM-4"] });
  assert.deepEqual(value.summary, { official: 4, executed: 2, passed: 1, failed: 1, blocked: 1, notRun: 1, passRate: 50, duration: 30 });
  assert.deepEqual(value.tests.map(({ status }) => status), ["PASS", "FAIL", "SKIPPED-BLOCKED", "NOT_RUN"]);
});

test("auth artifacts cannot be published", () => {
  assert.equal(safeArtifact("playwright/.auth/mx-s1-user.json", process.cwd()), null);
});
