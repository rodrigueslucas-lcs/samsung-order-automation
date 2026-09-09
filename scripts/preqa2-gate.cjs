const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");
const { validatePeQstReusePlan } = require("../utils/qstPeReusePlan");
const { validateS1OfficialImplementation } = require("../utils/qstS1Implementation");
const { validatePreqa2ValidationLedger } = require("../utils/preqa2ValidationLedger");
const { getCampaignSummary } = require("../utils/preqa2CampaignPlan");
const { getMarketClosureState } = require("../utils/preqa2ClosureGate");

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

  const requested = String(process.env.PREQA2_REQUIRE_SAFE_EXHAUSTED || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  for (const market of requested) {
    const state = getMarketClosureState(market);
    if (!state.safeExhausted) {
      const ids = state.remaining.safe.map((entry) => entry.id).join(", ");
      throw new Error(`${market} still has ${state.remaining.safe.length} safe official TC(s) NOT_RUN: ${ids}`);
    }
    console.log(`- ${market} safe campaign exhausted`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[preqa2-gate] ${error.message}`);
  process.exitCode = 1;
}
