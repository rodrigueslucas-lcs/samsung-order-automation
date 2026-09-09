const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");
const { validatePeQstReusePlan } = require("../utils/qstPeReusePlan");

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
