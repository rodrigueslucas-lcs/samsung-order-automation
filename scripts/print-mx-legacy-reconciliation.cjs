const { buildLegacyReconciliation } = require("../utils/legacyQstReconciliation");

const report = buildLegacyReconciliation();
console.log(JSON.stringify({
  sourceStatus: report.sourceStatus,
  historicalTotal: report.historicalTotal,
  counts: report.counts,
  market: "MX",
  cases: report.markets.MX,
}, null, 2));
