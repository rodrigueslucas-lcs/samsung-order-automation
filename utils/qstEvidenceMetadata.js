const mxCoverage = require("../test-mapping/mx-qst-coverage.json");

function getMxQstEvidenceMetadata(id, options = {}) {
  const current = mxCoverage.cases?.[id];
  if (!current) {
    throw new Error(`MX QST evidence metadata was not found for ${id}.`);
  }

  return {
    zephyrId: id,
    market: "MX",
    store: current.store,
    suite: options.suite || "QST",
    feature: current.feature,
    environment: options.environment || "S1",
    coverage: current.coverage,
    officialTitle: current.title,
  };
}

module.exports = { getMxQstEvidenceMetadata };
