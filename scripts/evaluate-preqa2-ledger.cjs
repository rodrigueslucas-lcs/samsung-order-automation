const fs = require("node:fs");
const path = require("node:path");
const { validatePreqa2ValidationLedger } = require("../utils/preqa2ValidationLedger");
const { getCampaignSummary } = require("../utils/preqa2CampaignPlan");
const { reconciliationSummary } = require("../utils/preqa2Reconciliation");
const { getPreqa2PromotionSummary } = require("../utils/preqa2PromotionPlan");
const { getAllMarketClosureStates } = require("../utils/preqa2ClosureGate");

function evaluate(sourceLedger) {
  const validation = validatePreqa2ValidationLedger(sourceLedger);
  const campaign = getCampaignSummary({ sourceLedger });
  const reconciliation = reconciliationSummary({ sourceLedger });
  const promotions = getPreqa2PromotionSummary({ sourceLedger });
  const closure = getAllMarketClosureStates({ sourceLedger });
  return { validation, campaign, reconciliation, promotions, closure };
}

function main(argv = process.argv.slice(2)) {
  const [ledgerPath] = argv;
  if (!ledgerPath) throw new Error("Usage: node scripts/evaluate-preqa2-ledger.cjs <ledger.json>");
  const sourceLedger = JSON.parse(fs.readFileSync(path.resolve(ledgerPath), "utf8"));
  const result = evaluate(sourceLedger);

  console.log("PreQA2 external ledger is canonical and valid.");
  for (const market of ["MX", "CL", "CO", "PE"]) {
    const validation = result.validation[market];
    const campaign = result.campaign[market];
    const closure = result.closure[market];
    const reconciliation = result.reconciliation[market];
    console.log(
      `${market}: executed=${validation.executed}/${validation.officialTotal} ` +
      `PASS=${closure.passed} FAIL=${closure.failed} BLOCKED=${closure.blocked} N/A=${closure.notApplicable} ` +
      `pending=${campaign.pending} safe=${campaign.safeCandidates} registered=${campaign.registeredPending} ` +
      `EPP=${campaign.eppPending} metadata-review=${campaign.needsOfficialReview} ` +
      `pass-without-automation=${reconciliation.passedWithoutAutomation}`
    );
  }
  console.log("Promotion review:");
  console.log(JSON.stringify(result.promotions, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[preqa2-ledger-evaluate] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { evaluate, main };
