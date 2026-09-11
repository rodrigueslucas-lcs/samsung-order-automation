const assert = require("node:assert/strict");
const test = require("node:test");
const { validateQstMapping } = require("../utils/qstMapping");
const { validateMxQstCoverage } = require("../utils/qstCoverage");
const { getMxQstEvidenceMetadata } = require("../utils/qstEvidenceMetadata");
const { validateMxPartialPlan } = require("../utils/qstPartialPlan");
const { validateSharedCoreFamilies } = require("../utils/qstArchitecture");
const { getSharedCandidateSummary } = require("../utils/qstSharedCandidates");
const { validatePeQstReusePlan } = require("../utils/qstPeReusePlan");
const { getPeQstEvidenceMetadata } = require("../utils/qstPeEvidenceMetadata");
const { validateS1OfficialImplementation } = require("../utils/qstS1Implementation");
const { getPeS1QstConfig, PROVEN_PE_QST_ST2_SKU } = require("../config/markets/pe");

test("SMB registry keeps the official 144-case market totals", () => {
  const result = validateQstMapping();
  assert.equal(result.total, 144);
  assert.deepEqual(result.markets, { MX: 37, CL: 38, CO: 35, PE: 34 });
});

test("MX coverage classifies every official case consistently as evidence evolves", () => {
  const result = validateMxQstCoverage();
  assert.equal(result.officialTotal, 37);
  assert.equal(result.full + result.partial + result.missing, 37);
  assert.ok(result.full >= 0);
  assert.ok(result.partial >= 0);
  assert.ok(result.missing >= 0);
});

test("MX partial plan contains every current Partial exactly once", () => {
  const result = validateMxPartialPlan();
  assert.equal(result.partialTotal, 14);
  assert.deepEqual(result.groups, {
    quickAssertion: 3,
    existingFlowExtension: 3,
    newBusinessFlow: 4,
    eppContext: 4,
  });
});

test("SMB shared-core families only reference official market IDs", () => {
  const result = validateSharedCoreFamilies();
  assert.equal(result.familyCount, 12);
});

test("SMB shared-core candidates expose the current reusable market backlog", () => {
  const summary = getSharedCandidateSummary();
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary).map(([market, entry]) => [market, entry.count])),
    { MX: 14, CL: 15, CO: 14, PE: 14 }
  );
});

test("PE reuse plan classifies all 34 official cases without claiming coverage", () => {
  const result = validatePeQstReusePlan();
  assert.equal(result.officialTotal, 34);
  assert.equal(
    result.directCandidate +
      result.extensionCandidate +
      result.destructiveCandidate +
      result.missing,
    34
  );
  assert.deepEqual(
    {
      directCandidate: result.directCandidate,
      extensionCandidate: result.extensionCandidate,
      destructiveCandidate: result.destructiveCandidate,
      missing: result.missing,
    },
    {
      directCandidate: 11,
      extensionCandidate: 14,
      destructiveCandidate: 3,
      missing: 6,
    }
  );
});

test("S1 implementation inventory only binds official IDs to the correct market", () => {
  const inventory = validateS1OfficialImplementation();

  assert.ok(inventory.MX.implementedCount >= 10);
  assert.ok(inventory.PE.implementedCount >= 17);
  assert.ok(inventory.CL.implementedCount >= 1);
  assert.ok(inventory.CO.implementedCount >= 1);

  assert.ok(inventory.MX.implementedIds.includes("SAM-25016"));
  assert.ok(inventory.PE.implementedIds.includes("SAM-25056"));
  assert.ok(inventory.PE.implementedIds.includes("SAM-25090"));
  assert.ok(inventory.CL.implementedIds.includes("SAM-24830"));
  assert.ok(inventory.CO.implementedIds.includes("SAM-24920"));
});

test("PE S1 config stays runtime-driven and market-scoped", () => {
  const config = getPeS1QstConfig({
    PE_STOREFRONT_URL: "https://staging.example.test/pe/",
    PE_SETUP_URL: "https://staging.example.test/getcookie.html",
    PE_QST_SKU: "PE-SKU",
    PE_QST_PDP_URL: "https://staging.example.test/pe/p/PE-SKU",
    PE_ADDRESS_API_URL:
      "https://api.example.test/tokocommercewebservices/v2/pe/users/current/addresses",
  });
  assert.equal(config.market, "PE");
  assert.equal(config.environment, "S1");
  assert.equal(config.baseUrl.href, "https://staging.example.test/pe/");
  assert.equal(config.cartUrl.href, "https://staging.example.test/pe/cart");
  assert.equal(config.sku, "PE-SKU");
  assert.equal(config.pdpUrl.href, "https://staging.example.test/pe/p/PE-SKU");
  assert.equal(
    config.addressApiUrl.href,
    "https://api.example.test/tokocommercewebservices/v2/pe/users/current/addresses"
  );

  const defaultProduct = getPeS1QstConfig({
    PE_STOREFRONT_URL: "https://staging.example.test/pe/",
  });
  assert.equal(defaultProduct.sku, PROVEN_PE_QST_ST2_SKU);
  assert.equal(
    defaultProduct.pdpUrl.href,
    `https://staging.example.test/pe/p/${PROVEN_PE_QST_ST2_SKU}`
  );

  assert.throws(
    () => getPeS1QstConfig({ PE_STOREFRONT_URL: "https://staging.example.test/mx/" }),
    /PE storefront root/
  );
  assert.throws(
    () =>
      getPeS1QstConfig({
        PE_STOREFRONT_URL: "https://staging.example.test/pe/",
        PE_QST_PDP_URL: "https://other.example.test/pe/p/PE-SKU",
      }),
    /same host/
  );
  assert.throws(
    () =>
      getPeS1QstConfig({
        PE_STOREFRONT_URL: "https://staging.example.test/pe/",
        PE_ADDRESS_API_URL: "https://api.example.test/not-addresses",
      }),
    /users\/current\/addresses/
  );
});

test("PE evidence metadata comes from the official reuse plan without claiming coverage", () => {
  assert.deepEqual(getPeQstEvidenceMetadata("SAM-25081"), {
    zephyrId: "SAM-25081",
    market: "PE",
    store: "BS",
    suite: "QST",
    feature: "Checkout",
    environment: "S1",
    officialTitle: "Checkout button on cart page",
    reuseCandidate: "directCandidate",
  });
  assert.throws(
    () => getPeQstEvidenceMetadata("SAM-00000"),
    /metadata was not found/
  );
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
