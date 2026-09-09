const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
} = require("../utils/preqa2PromotionPlan");

test("promotion planner never invents PASS when ledger has no executions", () => {
  const mx = getMxPreqa2PromotionPlan();
  const pe = getPePreqa2ValidationImpact();
  assert.deepEqual(mx, { promotions: [], retained: [], failedOrBlocked: [] });
  assert.deepEqual(pe, { passed: [], failedOrBlocked: [] });
});

test("promotion summary starts at zero and is evidence-driven", () => {
  assert.deepEqual(getPreqa2PromotionSummary(), {
    MX: { promotionCandidates: 0, retainedFull: 0, failedOrBlocked: 0 },
    PE: { officialPasses: 0, failedOrBlocked: 0 },
  });
});
