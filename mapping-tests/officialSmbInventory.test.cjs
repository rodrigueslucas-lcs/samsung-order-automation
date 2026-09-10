const assert = require("node:assert/strict");
const test = require("node:test");
const { cycleScope, nextAction, validateOfficialInventory, buildCycleReport } = require("../utils/officialSmbInventory");

function fixture(rows = []) {
  return {
    sourceStatus: "READY",
    markets: Object.fromEntries(["MX", "PE", "CL", "CO"].map((market) => [market, {
      contexts: { BASE_STORE: { source: `${market}-BS`, rows: market === "MX" ? rows : [] }, EPP: { source: `${market}-EPP`, rows: [] } },
    }])),
  };
}

const p1 = { sourceRowKey: "mx-bs-1", officialId: "SAM-1", scenario: "One", expectedResult: "Done", priority: "P1", coverage: "full", implemented: true, runtime: { status: "PASS" } };
const p2 = { sourceRowKey: "mx-bs-2", officialId: "SAM-2", scenario: "Two", expectedResult: "Done", priority: "P2" };

test("P1 derives QST and DST while P2 derives DST only", () => {
  assert.deepEqual(cycleScope("P1"), { qstIncluded: true, dstIncluded: true });
  assert.deepEqual(cycleScope("P2"), { qstIncluded: false, dstIncluded: true });
  assert.throws(() => cycleScope("UNKNOWN"), /Unknown official priority/);
});

test("official inventory rejects invalid scope, priority and duplicate identity", () => {
  assert.throws(() => validateOfficialInventory(fixture([{ ...p1, qstIncluded: false }])), /contradicts P1/);
  assert.throws(() => validateOfficialInventory(fixture([{ ...p1, priority: "P3" }])), /invalid priority/);
  assert.throws(() => validateOfficialInventory(fixture([p1, { ...p1, sourceRowKey: "other" }])), /duplicate official identity/);
});

test("QST denominator is P1 and DST denominator is P1 plus P2", () => {
  const report = buildCycleReport(fixture([p1, p2]));
  const { cases, ...metrics } = report.markets.MX.BASE_STORE;
  assert.deepEqual(metrics, {
    official: 2, p1: 1, p2: 1, qst: 1, dst: 2,
    full: 1, partial: 0, missing: 0, implemented: 1, notImplemented: 0,
    runtimePass: 1, runtimeFail: 0, blocked: 0, notRun: 0,
  });
  assert.equal(cases[0].nextAction, "LIVE_PROVEN");
});

test("all four markets and both contexts are mandatory", () => {
  const source = fixture();
  delete source.markets.CO.contexts.EPP;
  assert.throws(() => validateOfficialInventory(source), /CO\/EPP: context is missing/);
});

test("a declared source row cannot silently disappear", () => {
  const source = fixture([p1]);
  source.markets.MX.contexts.BASE_STORE.source = { file: "mx.xlsx", rowCount: 2 };
  assert.throws(() => validateOfficialInventory(source), /does not match represented rows/);
});

test("readiness actions keep coverage and runtime as separate dimensions", () => {
  assert.equal(nextAction({ implemented: true, coverage: "full", runtime: { status: "PASS" } }), "LIVE_PROVEN");
  assert.equal(nextAction({ implemented: true, coverage: "partial", runtime: { status: "PASS" } }), "REVIEW_EXPECTED_RESULT_COMPLETENESS");
  assert.equal(nextAction({ implemented: true, coverage: "partial", runtime: { status: "FAIL" } }), "INVESTIGATE_LIVE_FAIL");
  assert.equal(nextAction({ implemented: true, coverage: "missing" }), "RECONCILE_COVERAGE_DRIFT");
  assert.equal(nextAction({ implemented: false, coverage: "missing" }), "IMPLEMENT");
  assert.equal(nextAction({ implemented: true, coverage: "partial", environmentRequired: "EPP_CONTEXT" }), "RUN_IN_EPP_CONTEXT");
});

test("repository scaffold validates but refuses to imply imported source completeness", () => {
  const result = validateOfficialInventory();
  assert.equal(result.representedRows, 0);
  assert.equal(result.sourceStatus, "BLOCKED_MISSING_UPDATED_EXPORTS");
  assert.throws(() => validateOfficialInventory(undefined, { requireSources: true }), /official source is missing/);
});
