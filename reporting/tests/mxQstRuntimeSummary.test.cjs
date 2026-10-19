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

test("runtime summary distinguishes known PE BOGO and SC+ test-data blockers", () => {
  const report = { suites: [{ specs: [
    {
      title: "SAM-25068 Verify BOGO product on cart page",
      file: "tests/bogo.spec.js",
      tests: [{
        annotations: [{ type: "skip", description: "A currently eligible PE BOGO product is required for this environment." }],
        results: [{ status: "skipped", duration: 0, attachments: [] }],
      }],
    },
    {
      title: "SAM-25074 SC+ on cart page",
      file: "tests/sc-plus.spec.js",
      tests: [{
        annotations: [{ type: "skip", description: "Configured PE SKU does not currently expose SC+; provide a verified SC+-eligible PE_QST_PDP_URL/PE_QST_SKU." }],
        results: [{ status: "skipped", duration: 0, attachments: [] }],
      }],
    },
  ] }] };

  const value = buildMxQstRuntimeSummary(report, { officialIds: ["SAM-25068", "SAM-25074"], market: "PE", environment: "S1/STG" });
  assert.equal(value.tests[0].status, "SKIPPED-BLOCKED");
  assert.equal(value.tests[0].failureType, "MISSING_BOGO_PRODUCT");
  assert.equal(value.tests[0].blockedReason, "A currently eligible PE BOGO product is required for this environment.");
  assert.equal(value.tests[1].status, "SKIPPED-BLOCKED");
  assert.equal(value.tests[1].failureType, "MISSING_SC_PLUS_PRODUCT");
  assert.equal(value.tests[1].blockedReason, "Configured PE SKU does not currently expose SC+; provide a verified SC+-eligible PE_QST_PDP_URL/PE_QST_SKU.");
});

test("runtime summary classifies CL Trade-in and SC+ prerequisites without failing them", () => {
  const report = { suites: [{ specs: [
    {
      title: "SAM-24803 Verify Recycle & Save Trade-in on cart page",
      file: "tests/markets/cl/qst/base-store/official-p1.spec.js",
      tests: [{
        annotations: [{ type: "skip", description: "CL QST environment prerequisite BLOCKED: eligible CL Trade-in SKU/test data is required." }],
        results: [{ status: "skipped", duration: 0, attachments: [] }],
      }],
    },
    {
      title: "SAM-24804 SC+ on cart page",
      file: "tests/markets/cl/qst/base-store/official-p1.spec.js",
      tests: [{
        annotations: [{ type: "skip", description: "CL QST environment prerequisite BLOCKED: eligible CL Samsung Care+ SKU/test data is required." }],
        results: [{ status: "skipped", duration: 0, attachments: [] }],
      }],
    },
  ] }] };

  const value = buildMxQstRuntimeSummary(report, { officialIds: ["SAM-24803", "SAM-24804"], market: "CL", environment: "S2/STG2" });
  assert.equal(value.summary.failed, 0);
  assert.equal(value.summary.blocked, 2);
  assert.equal(value.tests[0].status, "SKIPPED-BLOCKED");
  assert.equal(value.tests[0].failureType, "MISSING_TRADE_IN_PRODUCT");
  assert.equal(value.tests[1].status, "SKIPPED-BLOCKED");
  assert.equal(value.tests[1].failureType, "MISSING_SC_PLUS_PRODUCT");
});

test("auth artifacts cannot be published", () => {
  assert.equal(safeArtifact("playwright/.auth/mx-s1-user.json", process.cwd()), null);
});
