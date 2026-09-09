const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
} = require("../utils/preqa2PromotionPlan");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

function mxPass({ automation = "not-assessed" } = {}) {
  return {
    status: "PASS",
    context: "either",
    runtimePath: "/mx/smartphones/all-smartphones/",
    evidence: "Official Expected Result observed in PreQA2.",
    automation,
    blocker: null,
    validatedAt: "2026-09-09T20:00:00.000Z",
  };
}

test("promotion planner never invents PASS or coverage change when source has no executions", () => {
  const sourceLedger = emptyLedger();
  const mx = getMxPreqa2PromotionPlan({ sourceLedger });
  const pe = getPePreqa2ValidationImpact({ sourceLedger });
  assert.deepEqual(mx, {
    coverageReviewCandidates: [],
    validationPassAutomationGap: [],
    retained: [],
    failedOrBlocked: [],
  });
  assert.deepEqual(pe, {
    passed: [],
    passedAutomationProven: [],
    failedOrBlocked: [],
  });
});

test("official PASS remains PASS even when automation coverage is still a gap", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = mxPass();
  const mx = getMxPreqa2PromotionPlan({ sourceLedger });
  assert.equal(mx.validationPassAutomationGap.length, 1);
  assert.equal(mx.validationPassAutomationGap[0].id, "SAM-24964");
  assert.equal(mx.validationPassAutomationGap[0].preqa2Status, "PASS");
  assert.equal(mx.coverageReviewCandidates.length, 0);
});

test("automation coverage review requires explicit implemented-proven evidence", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = mxPass({ automation: "implemented-proven" });
  const mx = getMxPreqa2PromotionPlan({ sourceLedger });
  assert.equal(mx.coverageReviewCandidates.length, 1);
  assert.equal(mx.coverageReviewCandidates[0].id, "SAM-24964");
  assert.equal(mx.validationPassAutomationGap.length, 0);
});

test("promotion summary derives counts from injected official evidence", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = mxPass();
  assert.deepEqual(getPreqa2PromotionSummary({ sourceLedger }), {
    MX: {
      coverageReviewCandidates: 0,
      officialPassCoverageGap: 1,
      retainedFull: 0,
      failedOrBlocked: 0,
    },
    PE: {
      officialPasses: 0,
      automationProvenPasses: 0,
      failedOrBlocked: 0,
    },
  });
});
