const { auditMxMetadataDrift } = require("../utils/qstMetadataDrift");

const audit = auditMxMetadataDrift();
console.log(
  `MX metadata audit: coverage=${audit.officialCoverageCount} architecture=${audit.architectureCount} ` +
  `title-drift=${audit.titleDrift.length} feature-drift=${audit.featureDrift.length}`
);

if (audit.titleDrift.length) {
  console.log("\nTitle drift (review only; no source is auto-rewritten):");
  for (const item of audit.titleDrift) {
    console.log(`- ${item.id}\n  coverage: ${item.coverage}\n  architecture: ${item.architecture}`);
  }
}
if (audit.featureDrift.length) {
  console.log("\nFeature taxonomy drift (review only):");
  for (const item of audit.featureDrift) {
    console.log(`- ${item.id}: coverage=${item.coverage} | architecture=${item.architecture}`);
  }
}
