const { buildMxQstReadiness } = require("../utils/mxQstReadiness");

const report = buildMxQstReadiness();
console.log(`MX QST readiness: ${report.officialTotal} official TCs`);
console.log(JSON.stringify(report.summary, null, 2));

for (const item of report.cases) {
  console.log([
    item.id,
    item.store,
    item.feature,
    `coverage=${item.coverage}`,
    `implemented=${item.implemented ? "yes" : "no"}`,
    `runtime=${item.runtimeStatus}`,
    `target=${item.targetEnvironment}`,
    `next=${item.nextAction}`,
    item.coverageDrift ? "DRIFT=implementation-present-but-coverage-missing" : "",
  ].filter(Boolean).join(" | "));
}
