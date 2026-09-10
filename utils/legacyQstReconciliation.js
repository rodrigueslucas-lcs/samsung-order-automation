const legacy = require("../test-mapping/smb-qst.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");

function buildLegacyReconciliation() {
  const markets = {};
  for (const [market, value] of Object.entries(legacy.markets)) {
    markets[market] = value.cases.map((officialId) => {
      const known = market === "MX" ? mxCoverage.cases[officialId] : null;
      return {
        officialId,
        legacyRepresentation: "QST_2026_09_02_EXECUTION_CAMPAIGN",
        legacyContext: known?.store === "BS" ? "BASE_STORE" : known?.store === "EPP" ? "EPP" : "UNRESOLVED",
        currentTemplateMatch: "UNRESOLVED_SOURCE_UNAVAILABLE",
        currentTemplateRowKey: null,
        note: "Retained until the updated market template can establish a confident current-scenario match.",
      };
    });
  }
  return {
    generatedFrom: "test-mapping/smb-qst.json",
    sourceStatus: "BLOCKED_MISSING_UPDATED_EXPORTS",
    historicalTotal: legacy.total,
    markets,
  };
}

module.exports = { buildLegacyReconciliation };
