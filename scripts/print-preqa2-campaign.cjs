const { getCampaignSummary, getPreqa2CampaignPlan, MARKET_ORDER } = require("../utils/preqa2CampaignPlan");

const requested = process.argv[2]?.trim().toUpperCase();
const markets = requested ? [requested] : MARKET_ORDER;
const summary = getCampaignSummary();

function requirementLabel(entry) {
  const labels = [];
  if (entry.requiresSamsungAccount) labels.push("registered-account");
  if (entry.requiresGuestState) labels.push("guest");
  if (entry.requiresEppContext) labels.push("EPP");
  return labels.length ? labels.join("+") : entry.context || "unknown-context";
}

console.log("PreQA2 official SMB QST campaign");
for (const market of markets) {
  const plan = getPreqa2CampaignPlan(market);
  const current = summary[market];
  console.log(
    `\n${market}: official=${plan.officialTotal} executed=${plan.executed} pending=${plan.pending} ` +
      `safe=${current.safeCandidates} guarded-review=${current.guardedReview} ` +
      `needs-official-review=${current.needsOfficialReview} registered=${current.registeredPending} ` +
      `guest=${current.guestPending} epp=${current.eppPending}`
  );
  for (const entry of plan.cases) {
    if (entry.executionStatus !== "NOT_RUN") continue;
    console.log(
      `- P${String(entry.priority).padStart(2, "0")} ${entry.id} | ${entry.store} | ${entry.feature} | ` +
        `${entry.baseline} | ${entry.safety} | ${requirementLabel(entry)}` +
        `${entry.title ? ` | ${entry.title}` : ""}`
    );
  }
}
