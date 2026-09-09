const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
} = require("../utils/preqa2PromotionPlan");

test("promotion planner never invents PASS or coverage change when ledger has no executions", () => {
  const mx = getMxPreqa2PromotionPlan();
  const pe = getPePreqa2ValidationImpact();
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

test("promotion summary starts at zero and separates validation from automation coverage", () => {
  assert.deepEqual(getPreqa2PromotionSummary(), {
    MX: {
      coverageReviewCandidates: 0,
      officialPassCoverageGap: 0,
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
