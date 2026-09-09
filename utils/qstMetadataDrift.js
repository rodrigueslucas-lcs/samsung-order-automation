const architecture = require("../test-mapping/smb-qst-architecture.json");
const coverage = require("../test-mapping/mx-qst-coverage.json");

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeFeature(value) {
  return normalizeText(value).replace(/backoffice/g, "backoffice");
}

function auditMxMetadataDrift() {
  const architectureById = new Map(
    (architecture.markets?.MX?.cases || []).map((entry) => [entry.id, entry])
  );
  const coverageIds = Object.keys(coverage.cases || {});
  const missingArchitecture = [];
  const titleDrift = [];
  const featureDrift = [];

  for (const id of coverageIds) {
    const left = coverage.cases[id];
    const right = architectureById.get(id);
    if (!right) {
      missingArchitecture.push(id);
      continue;
    }
    if (normalizeText(left.title) !== normalizeText(right.title)) {
      titleDrift.push({ id, coverage: left.title, architecture: right.title });
    }
    if (normalizeFeature(left.feature) !== normalizeFeature(right.feature)) {
      featureDrift.push({ id, coverage: left.feature, architecture: right.feature });
    }
  }

  const architectureOnly = [...architectureById.keys()].filter((id) => !coverage.cases?.[id]);
  return {
    officialCoverageCount: coverageIds.length,
    architectureCount: architectureById.size,
    missingArchitecture,
    architectureOnly,
    titleDrift,
    featureDrift,
  };
}

module.exports = { auditMxMetadataDrift, normalizeFeature, normalizeText };
