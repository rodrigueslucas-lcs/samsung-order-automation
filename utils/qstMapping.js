const mapping = require("../test-mapping/smb-qst.json");

const EXPECTED_COUNTS = Object.freeze({ MX: 37, CL: 38, CO: 35, PE: 34 });

function normalizeMarket(value) {
  const market = String(value || "").trim().toUpperCase();
  if (!mapping.markets[market]) {
    throw new Error(`Unknown SMB QST market: ${value}`);
  }
  return market;
}

function getMarketQst(value) {
  return mapping.markets[normalizeMarket(value)];
}

function getQstCase(marketValue, id) {
  const market = normalizeMarket(marketValue);
  const testCase = mapping.markets[market].find((item) => item.id === id);
  if (!testCase) {
    throw new Error(`QST case ${id} was not found for ${market}.`);
  }
  return testCase;
}

function validateQstMapping() {
  const errors = [];
  let total = 0;

  for (const [market, expected] of Object.entries(EXPECTED_COUNTS)) {
    const cases = mapping.markets[market] || [];
    total += cases.length;

    if (cases.length !== expected) {
      errors.push(`${market}: expected ${expected}, found ${cases.length}`);
    }

    const ids = cases.map((item) => item.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length) {
      errors.push(`${market}: duplicate IDs ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  if (total !== mapping.total) {
    errors.push(`SMB total: expected ${mapping.total}, found ${total}`);
  }

  if (errors.length) {
    throw new Error(`Invalid SMB QST mapping:\n${errors.join("\n")}`);
  }

  return { total, markets: { ...EXPECTED_COUNTS } };
}

module.exports = {
  EXPECTED_COUNTS,
  getMarketQst,
  getQstCase,
  normalizeMarket,
  validateQstMapping,
};
