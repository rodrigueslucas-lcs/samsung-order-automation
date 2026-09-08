const { validateQstMapping } = require("../utils/qstMapping");

const result = validateQstMapping();
console.log(`SMB QST mapping OK: ${result.total} test cases`);
for (const [market, count] of Object.entries(result.markets)) {
  console.log(`- ${market}: ${count}`);
}
