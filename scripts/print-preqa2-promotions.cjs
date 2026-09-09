const {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
} = require("../utils/preqa2PromotionPlan");

console.log("PreQA2 evidence-backed promotion review");
console.log(JSON.stringify(getPreqa2PromotionSummary(), null, 2));

const mx = getMxPreqa2PromotionPlan();
if (mx.promotions.length) {
  console.log("\nMX promotion candidates:");
  for (const entry of mx.promotions) {
    console.log(`- ${entry.id} | ${entry.action} | ${entry.store} | ${entry.feature} | ${entry.runtimePath || "no-path"}`);
  }
}
if (mx.failedOrBlocked.length) {
  console.log("\nMX failures/blockers requiring review:");
  for (const entry of mx.failedOrBlocked) console.log(`- ${entry.id} | ${entry.preqa2Status}`);
}

const pe = getPePreqa2ValidationImpact();
if (pe.passed.length) {
  console.log("\nPE official PreQA2 PASS results:");
  for (const entry of pe.passed) {
    console.log(`- ${entry.id} | ${entry.baselineReuse} | ${entry.store} | ${entry.feature}`);
  }
}
