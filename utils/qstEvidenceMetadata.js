const mxCoverage = require("../governance/mx-qst-coverage.json");

function runtimeEnvironment(explicit) {
  const value = String(explicit || process.env.MX_QST_ENVIRONMENT || process.env.TEST_ENV || "S1").toUpperCase();
  return value.includes("S2") || value.includes("STG2") ? "S2" : "S1";
}

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
    environment: runtimeEnvironment(options.environment),
    coverage: current.coverage,
    officialTitle: current.title,
  };
}

module.exports = { getMxQstEvidenceMetadata };
