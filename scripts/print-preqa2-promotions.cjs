const {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
} = require("../utils/preqa2PromotionPlan");

console.log("PreQA2 official PASS vs automation coverage review");
console.log(JSON.stringify(getPreqa2PromotionSummary(), null, 2));

const mx = getMxPreqa2PromotionPlan();
if (mx.coverageReviewCandidates.length) {
  console.log("\nMX coverage review candidates (not automatic promotion):");
  for (const entry of mx.coverageReviewCandidates) {
    console.log(`- ${entry.id} | ${entry.action} | ${entry.store} | ${entry.feature} | ${entry.runtimePath || "no-path"}`);
  }
}
if (mx.validationPassAutomationGap.length) {
  console.log("\nMX official PASS with automation coverage still unchanged:");
  for (const entry of mx.validationPassAutomationGap) {
    console.log(`- ${entry.id} | ${entry.baselineCoverage} | automation=${entry.automation}`);
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
    console.log(`- ${entry.id} | ${entry.baselineReuse} | automation=${entry.automation} | ${entry.store} | ${entry.feature}`);
  }
}
