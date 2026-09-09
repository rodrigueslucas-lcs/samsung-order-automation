const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");

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
