const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");
const { validatePeQstReusePlan } = require("../utils/qstPeReusePlan");
const { validateS1OfficialImplementation } = require("../utils/qstS1Implementation");
const { validatePreqa2ValidationLedger } = require("../utils/preqa2ValidationLedger");
const { getCampaignSummary } = require("../utils/preqa2CampaignPlan");
const { getMarketClosureState } = require("../utils/preqa2ClosureGate");

function requestedMarkets(variable) {
  return String(process.env[variable] || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function assertRemainingEmpty(variable, bucket, label) {
  for (const market of requestedMarkets(variable)) {
    const state = getMarketClosureState(market);
    const entries = state.remaining[bucket] || [];
    if (entries.length) {
      throw new Error(
        `${market} still has ${entries.length} ${label} official TC(s) NOT_RUN: ` +
        entries.map((entry) => entry.id).join(", ")
      );
    }
    console.log(`- ${market} ${label} campaign exhausted`);
  }
}

function main() {
  const mapping = validateQstMapping();
  const mxCoverage = validateMxQstCoverage();
  const mxPartial = validateMxPartialPlan();
  const shared = validateSharedCoreFamilies();
  const peReuse = validatePeQstReusePlan();
  const implementation = validateS1OfficialImplementation();
  const ledger = validatePreqa2ValidationLedger();
  const campaign = getCampaignSummary();

  console.log(`PreQA2 gate OK: official SMB=${mapping.total}`);
  console.log(`- official markets: ${Object.entries(mapping.markets).map(([m, n]) => `${m}=${n}`).join(", ")}`);
  console.log(`- MX automation coverage: full=${mxCoverage.full} partial=${mxCoverage.partial} missing=${mxCoverage.missing}`);
  console.log(`- MX partial plan: ${mxPartial.partialTotal}`);
  console.log(`- shared-core families: ${shared.familyCount}`);
  console.log(`- PE reuse plan: direct=${peReuse.directCandidate} extension=${peReuse.extensionCandidate} destructive=${peReuse.destructiveCandidate} missing=${peReuse.missing}`);
  console.log(`- implementation: ${Object.entries(implementation).map(([m, e]) => `${m}=${e.implementedCount}/${e.officialTotal}`).join(", ")}`);
  console.log(`- official execution: ${Object.entries(ledger).map(([m, e]) => `${m}=${e.executed}/${e.officialTotal}`).join(", ")}`);
  console.log(`- pending: ${Object.entries(campaign).map(([m, e]) => `${m}=${e.pending}`).join(", ")}`);
  console.log(`- registered pending: ${Object.entries(campaign).map(([m, e]) => `${m}=${e.registeredPending}`).join(", ")}`);
  console.log(`- guest pending: ${Object.entries(campaign).map(([m, e]) => `${m}=${e.guestPending}`).join(", ")}`);
  console.log(`- EPP pending: ${Object.entries(campaign).map(([m, e]) => `${m}=${e.eppPending}`).join(", ")}`);
  console.log(`- official metadata review: ${Object.entries(campaign).map(([m, e]) => `${m}=${e.needsOfficialReview}`).join(", ")}`);

  assertRemainingEmpty("PREQA2_REQUIRE_SAFE_EXHAUSTED", "safe", "safe");
  assertRemainingEmpty("PREQA2_REQUIRE_REGISTERED_EXHAUSTED", "registered", "registered-account");
  assertRemainingEmpty("PREQA2_REQUIRE_EPP_EXHAUSTED", "epp", "EPP");
}

try {
  main();
} catch (error) {
  console.error(`[preqa2-gate] ${error.message}`);
  process.exitCode = 1;
}

module.exports = { assertRemainingEmpty, main, requestedMarkets };
