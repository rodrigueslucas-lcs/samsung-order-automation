const assert = require("node:assert/strict");
const test = require("node:test");
const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");

test("SMB registry keeps the official 144-case market totals", () => {
  const result = validateQstMapping();
  assert.equal(result.total, 144);
  assert.deepEqual(result.markets, { MX: 37, CL: 38, CO: 35, PE: 34 });
});

test("MX coverage classifies every official case consistently", () => {
  const result = validateMxQstCoverage();
  assert.equal(result.officialTotal, 37);
  assert.equal(result.full + result.partial + result.missing, 37);
  assert.deepEqual(
    { full: result.full, partial: result.partial, missing: result.missing },
    { full: 5, partial: 14, missing: 18 }
  );
});
