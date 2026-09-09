const assert = require("node:assert/strict");
const test = require("node:test");
const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { getMxQstEvidenceMetadata } = require("../utils/qstEvidenceMetadata");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");

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

test("MX partial plan contains every current Partial exactly once", () => {
  const result = validateMxPartialPlan();
  assert.equal(result.partialTotal, 14);
  assert.deepEqual(result.groups, {
    quickAssertion: 4,
    existingFlowExtension: 2,
    newBusinessFlow: 4,
    eppContext: 4,
  });
});

test("SMB shared-core families only reference official market IDs", () => {
  const result = validateSharedCoreFamilies();
  assert.equal(result.familyCount, 13);
});

test("MX evidence metadata is derived from official mapping", () => {
  assert.deepEqual(getMxQstEvidenceMetadata("SAM-24988"), {
    zephyrId: "SAM-24988",
    market: "MX",
    store: "BS",
    suite: "QST",
    feature: "Checkout",
    environment: "S1",
    coverage: "full",
    officialTitle: "Checkout button on cart page",
  });
});

test("unknown MX evidence IDs are rejected", () => {
  assert.throws(
    () => getMxQstEvidenceMetadata("SAM-00000"),
    /metadata was not found/
  );
});
