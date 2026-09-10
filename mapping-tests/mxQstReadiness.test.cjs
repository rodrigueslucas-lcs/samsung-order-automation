const assert = require("node:assert/strict");
const test = require("node:test");
const { buildMxQstReadiness, idsFromPreqaRunner } = require("../utils/mxQstReadiness");

test("MX readiness reconciles all 37 official cases across implementation, runtime and environment", () => {
  const report = buildMxQstReadiness();
  assert.equal(report.market, "MX");
  assert.equal(report.officialTotal, 37);
  assert.equal(report.cases.length, 37);
  assert.equal(report.summary.runtimePass, 3);
  assert.equal(report.summary.runtimeFail, 1);
  assert.equal(report.summary.stagingRequired, 28);
  assert.equal(report.summary.eppContextBlocked, 5);
});

test("PreQA live runner implementation is discovered independently from runtime outcome", () => {
  const ids = idsFromPreqaRunner();
  assert.ok(ids.includes("SAM-24963"));
  assert.ok(ids.includes("SAM-24964"));
  assert.ok(ids.includes("SAM-24968"));

  const report = buildMxQstReadiness();
  const filter = report.cases.find((item) => item.id === "SAM-24968");
  assert.equal(filter.implemented, true);
  assert.equal(filter.runtimeStatus, "FAIL");
  assert.equal(filter.nextAction, "INVESTIGATE_LIVE_FAIL");
});

test("implemented cases are no longer confused with missing automation", () => {
  const report = buildMxQstReadiness();
  const mobile = report.cases.find((item) => item.id === "SAM-25016");
  assert.equal(mobile.implemented, true);
  assert.equal(mobile.coverage, "partial");
  assert.equal(mobile.coverageDrift, false);

  const filter = report.cases.find((item) => item.id === "SAM-24968");
  assert.equal(filter.implemented, true);
  assert.equal(filter.coverage, "partial");
  assert.equal(filter.coverageDrift, false);
  assert.equal(report.summary.coverageDrift, 0);
});
