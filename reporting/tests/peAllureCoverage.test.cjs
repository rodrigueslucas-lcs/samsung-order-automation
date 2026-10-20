const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plan = require("../../governance/pe-qst-reuse-plan.json");

const root = path.resolve(__dirname, "../..");
const enrichment = fs.readFileSync(path.join(root, "scripts/enrich-allure-pe-qst.cjs"), "utf8");
const flows = fs.readFileSync(path.join(root, "tests/markets/pe/qst/base-store/peQstFlows.js"), "utf8");
const finalize = fs.readFileSync(path.join(root, "scripts/finalize-jenkins-suite.cjs"), "utf8");

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

test("Jenkins finalization invokes PE Allure enrichment", () => {
  assert.match(finalize, /PE:\s*'scripts\/enrich-allure-pe-qst\.cjs'/);
  assert.match(finalize, /qst-evidence\.json/);
});
