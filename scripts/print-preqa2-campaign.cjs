const { getCampaignSummary, getPreqa2CampaignPlan, MARKET_ORDER } = require("../utils/preqa2CampaignPlan");

const requested = process.argv[2]?.trim().toUpperCase();
const markets = requested ? [requested] : MARKET_ORDER;
const summary = getCampaignSummary();

console.log("PreQA2 official SMB QST campaign");
for (const market of markets) {
  const plan = getPreqa2CampaignPlan(market);
  const current = summary[market];
  console.log(
    `\n${market}: official=${plan.officialTotal} executed=${plan.executed} pending=${plan.pending} ` +
      `safe=${current.safeCandidates} guarded-review=${current.guardedReview}`
  );
  for (const entry of plan.cases) {
    if (entry.executionStatus !== "NOT_RUN") continue;
    console.log(
      `- P${String(entry.priority).padStart(2, "0")} ${entry.id} | ${entry.store} | ${entry.feature} | ` +
        `${entry.baseline} | ${entry.safety}${entry.title ? ` | ${entry.title}` : ""}`
    );
  }
}
