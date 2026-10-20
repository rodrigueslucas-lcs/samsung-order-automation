const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plan = require("../../governance/pe-qst-reuse-plan.json");
const peBusinessEvidence = require("../../utils/peBusinessEvidence.cjs");

const root = path.resolve(__dirname, "../..");
const enrichment = fs.readFileSync(path.join(root, "scripts/enrich-allure-pe-qst.cjs"), "utf8");
const flows = fs.readFileSync(path.join(root, "tests/markets/pe/qst/base-store/peQstFlows.js"), "utf8");
const orderSpec = fs.readFileSync(path.join(root, "tests/markets/pe/qst/base-store/official-gap-safe.spec.js"), "utf8");
const finalize = fs.readFileSync(path.join(root, "scripts/finalize-jenkins-suite.cjs"), "utf8");
const dedupe = fs.readFileSync(path.join(root, "scripts/dedupe-allure-evidence.cjs"), "utf8");

const officialBaseStoreIds = Object.entries(plan.cases)
  .filter(([, entry]) => entry.store === "BS")
  .map(([id]) => id)
  .sort();

const detailedIds = [...enrichment.matchAll(/"(SAM-\d+)"\s*:\s*D\(/g)]
  .map((match) => match[1])
  .sort();

test("PE Allure enrichment explicitly covers every official Base Store P1 TC", () => {
  assert.equal(officialBaseStoreIds.length, 28);
  assert.deepEqual(detailedIds, officialBaseStoreIds);
});

test("PE common flow captures sanitized business request-response evidence", () => {
  assert.match(flows, /captureBusinessExchange/);
  assert.match(flows, /Add to Cart/);
  assert.match(flows, /Checkout Entry/);
  assert.match(flows, /Delivery Address/);
  assert.match(flows, /Checkout to Payment/);
});

test("PE order confirmation publishes submit network and order identity evidence", () => {
  assert.match(orderSpec, /captureBusinessExchange\(page, testInfo, "Order Submit"/);
  assert.match(orderSpec, /attachOrderEvidence\(testInfo/);
  assert.match(orderSpec, /orderCode:\s*result\.orderCode/);
  assert.match(orderSpec, /networkSummary:\s*result\.responses/);
  assert.match(orderSpec, /confirmationValidated:\s*true/);
});

test("PE business exchange removes query strings and sanitizes sensitive payload fields", async () => {
  assert.equal(
    peBusinessEvidence.safeEndpoint("https://stg2.shop.samsung.com/pe/api/orders?token=secret&x=1"),
    "https://stg2.shop.samsung.com/pe/api/orders"
  );

  const request = {
    method: () => "POST",
    url: () => "https://stg2.shop.samsung.com/pe/api/orders?token=secret",
    headers: () => ({ "content-type": "application/json" }),
    postData: () => JSON.stringify({
      sku: "SM-TEST",
      email: "qa@example.com",
      token: "secret-token",
      cardNumber: "4111111111111111",
    }),
  };
  const response = {
    request: () => request,
    headers: () => ({ "content-type": "application/json" }),
    status: () => 201,
    ok: () => true,
    text: async () => JSON.stringify({
      orderCode: "PE261020-12345678",
      email: "qa@example.com",
      phone: "999999999",
    }),
  };

  const exchange = await peBusinessEvidence.serializeExchange(response);
  assert.equal(exchange.endpoint, "https://stg2.shop.samsung.com/pe/api/orders");
  assert.equal(exchange.request.body.sku, "SM-TEST");
  assert.equal(exchange.request.body.email, "[REDACTED]");
  assert.equal(exchange.request.body.token, "[REDACTED]");
  assert.equal(exchange.request.body.cardNumber, "[REDACTED]");
  assert.equal(exchange.response.body.orderCode, "PE261020-12345678");
  assert.equal(exchange.response.body.email, "[REDACTED]");
  assert.equal(exchange.response.body.phone, "[REDACTED]");
});

test("Allure normalization preserves PE business evidence names", () => {
  assert.match(dedupe, /error\[ \.\_\-\]\*context/i);
  assert.doesNotMatch(dedupe, /\/error\.context\|context\/i/);
});

test("Jenkins finalization invokes PE Allure enrichment", () => {
  assert.match(finalize, /PE:\s*'scripts\/enrich-allure-pe-qst\.cjs'/);
  assert.match(finalize, /qst-evidence\.json/);
});
