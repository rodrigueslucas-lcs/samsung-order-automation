const { reconcileAllMarkets, reconciliationSummary } = require("../utils/preqa2Reconciliation");

const summary = reconciliationSummary();
const all = reconcileAllMarkets();

console.log("PreQA2 official validation vs automation reconciliation");
for (const [market, entry] of Object.entries(summary)) {
  console.log(
    `\n${market}: official=${entry.officialTotal} implemented=${entry.implemented} executed=${entry.executed} ` +
      `pending-implemented=${entry.pendingImplemented} pending-automation-gap=${entry.pendingAutomationGap} ` +
      `pass-without-automation=${entry.passedWithoutAutomation} failed-with-automation=${entry.failedWithAutomation} blocked=${entry.blocked}`
  );

  const current = all[market];
  if (current.passAutomationGap.length) {
    console.log("  PASS needing automation implementation:");
    for (const item of current.passAutomationGap) {
      console.log(`  - ${item.id} | ${item.store} | ${item.feature}${item.title ? ` | ${item.title}` : ""}`);
    }
  }
  if (current.failImplemented.length) {
    console.log("  FAIL with existing automation requiring diagnosis:");
    for (const item of current.failImplemented) {
      console.log(`  - ${item.id} | ${item.store} | ${item.feature}${item.title ? ` | ${item.title}` : ""}`);
    }
  }
}
