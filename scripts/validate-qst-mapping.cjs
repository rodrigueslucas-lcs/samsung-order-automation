const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");
const { validatePeQstReusePlan } = require("../utils/qstPeReusePlan");
const { validateS1OfficialImplementation } = require("../utils/qstS1Implementation");
const { validatePreqa2ValidationLedger } = require("../utils/preqa2ValidationLedger");
const { getCampaignSummary } = require("../utils/preqa2CampaignPlan");

const result = validateQstMapping();
console.log(`SMB QST mapping OK: ${result.total} test cases`);
for (const [market, count] of Object.entries(result.markets)) {
  console.log(`- ${market}: ${count}`);
}

const coverage = validateMxQstCoverage();
console.log(
  `MX QST coverage OK: ${coverage.officialTotal} classified ` +
    `(full=${coverage.full}, partial=${coverage.partial}, missing=${coverage.missing})`
);

const partialPlan = validateMxPartialPlan();
console.log(
  `MX partial plan OK: ${partialPlan.partialTotal} cases ` +
    Object.entries(partialPlan.groups)
      .map(([group, count]) => `${group}=${count}`)
      .join(", ")
);

const architecture = validateSharedCoreFamilies();
console.log(`SMB shared-core architecture OK: ${architecture.familyCount} families`);

const peReuse = validatePeQstReusePlan();
console.log(
  `PE QST reuse plan OK: ${peReuse.officialTotal} official cases ` +
    `(direct=${peReuse.directCandidate}, extension=${peReuse.extensionCandidate}, ` +
    `destructive=${peReuse.destructiveCandidate}, missing=${peReuse.missing})`
);

const implementation = validateS1OfficialImplementation();
console.log(
  "S1 official QST implementation inventory OK: " +
    Object.entries(implementation)
      .map(([market, entry]) => `${market}=${entry.implementedCount}/${entry.officialTotal}`)
      .join(", ")
);

const preqa2Ledger = validatePreqa2ValidationLedger();
const campaign = getCampaignSummary();
console.log(
  "PreQA2 official validation ledger OK: " +
    Object.entries(preqa2Ledger)
      .map(([market, entry]) => `${market}=${entry.executed}/${entry.officialTotal} executed`)
      .join(", ")
);
console.log(
  "PreQA2 pending campaign: " +
    Object.entries(campaign)
      .map(([market, entry]) =>
        `${market}=${entry.pending} pending (` +
        `${entry.safeCandidates} safe, ${entry.guardedReview} guarded-review, ` +
        `${entry.needsOfficialReview} needs-official-review)`
      )
      .join(", ")
);
