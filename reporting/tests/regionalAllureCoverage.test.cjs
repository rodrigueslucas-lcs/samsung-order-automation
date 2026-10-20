const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const coPlan = require("../../governance/co-qst-plan.json");
const clPlan = require("../../governance/cl-qst-plan.json");
const mxCoverage = require("../../governance/mx-qst-coverage.json");
const { enrichOfficialQst, normalizeStore } = require("../allure/officialQstEnrichment.cjs");

function idsFromBlock(source, pattern, label) {
  const block = source.match(pattern);
  assert.ok(block, `${label} declaration must exist`);
  return [...block[1].matchAll(/"(SAM-\d+)"/g)].map((match) => match[1]).sort();
}

function auditedIds(source) {
  return idsFromBlock(source, /const AUDITED_BASE_STORE_IDS = Object\.freeze\(\[([\s\S]*?)\]\);/, "AUDITED_BASE_STORE_IDS");
}

function detailIds(source) {
  return idsFromBlock(source, /const DETAILS = \{([\s\S]*?)\n\};\n\nenrichOfficialQst/, "DETAILS");
}

function officialIds(cases) {
  return Object.entries(cases)
    .filter(([, entry]) => normalizeStore(entry.store) === "BASE_STORE" && entry.scopeStatus !== "historical-only")
    .map(([id]) => id)
    .sort();
}

test("regional official Base Store inventories and per-TC journeys are exhaustively audited", () => {
  const coSource = read("scripts/enrich-allure-co-qst.cjs");
  const clSource = read("scripts/enrich-allure-cl-qst.cjs");
  const mxSource = read("scripts/enrich-allure-mx-qst.cjs");

  const co = officialIds(coPlan.cases);
  const cl = officialIds(clPlan.cases);
  const mx = officialIds(mxCoverage.cases);

  assert.equal(co.length, 29);
  assert.equal(cl.length, 31);
  assert.equal(mx.length, 29);
  assert.deepEqual(auditedIds(coSource), co);
  assert.deepEqual(auditedIds(clSource), cl);
  assert.deepEqual(auditedIds(mxSource), mx);
  assert.deepEqual(detailIds(coSource), co);
  assert.deepEqual(detailIds(clSource), cl);
  assert.deepEqual(detailIds(mxSource), mx);
  assert.ok(!mx.includes("SAM-25006"), "historical-only MX SAM-25006 must not inflate active P1 scope");
});

test("shared enrichment normalizes BS and exposes only actionable known defects", () => {
  const source = read("reporting/allure/officialQstEnrichment.cjs");
  assert.equal(normalizeStore("BS"), "BASE_STORE");
  assert.equal(normalizeStore("BASE-STORE"), "BASE_STORE");
  assert.match(source, /extractRuntimeOutputEvidence/);
  assert.match(source, /Order ID/);
  assert.match(source, /\["FAIL", "BLOCKED"\]\.includes\(runtimeStatus\)/);
  assert.match(source, /mappedDefect/);
  assert.match(source, /collectEvidenceFiles/);
});

test("regional finalization sends the correct evidence argument to each Allure enricher", () => {
  const finalize = read("scripts/finalize-jenkins-suite.cjs");
  const mxFinalize = read("scripts/finalize-allure-mx-qst.cjs");
  const clRunner = read("scripts/run-cl-qst-p1.cjs");

  for (const market of ["MX", "CO", "CL", "PE"]) {
    assert.match(finalize, new RegExp(`${market}: 'scripts/enrich-allure-${market.toLowerCase()}-qst\\.cjs'`));
  }
  assert.match(finalize, /const evidenceRoot = path\.join\(artifactDir, 'evidence'\)/);
  assert.match(finalize, /market === 'PE' \? path\.join\(evidenceRoot, 'qst-evidence\.json'\) : evidenceRoot/);
  assert.match(mxFinalize, /evidenceRoot/);
  assert.match(mxFinalize, /enrich-allure-mx-qst\.cjs/);
  assert.match(clRunner, /ALLURE_RESULTS_DIR: allureResultsDir/);
  assert.match(clRunner, /ENABLE_ALLURE:/);
});

test("CO CL and MX publish controlled product and business API evidence", () => {
  const coFlow = read("tests/markets/co/qst/base-store/coQstFlows.js");
  const clFlow = read("flows/cl/qstFlows.js");
  const mxFixture = read("tests/markets/mx/qst/base-store/mxQst.fixture.js");
  const mxAuthFixture = read("tests/markets/mx/dst/base-store/mx.auth.fixture.js");
  const regionalNetwork = read("utils/businessNetworkEvidence.js");

  for (const source of [coFlow, clFlow]) {
    assert.match(source, /recordBusinessEvidence/);
    assert.match(source, /Product Context/);
    assert.match(source, /attachNetworkEvidence/);
    assert.match(source, /installBusinessNetworkEvidence/);
    assert.match(source, /Add to Cart/);
  }
  assert.match(regionalNetwork, /Delivery \$\{method\}/);
  assert.match(regionalNetwork, /Address \$\{method\}/);
  assert.match(regionalNetwork, /Payment \$\{method\}/);
  assert.match(regionalNetwork, /Order \$\{method\}/);
  assert.match(regionalNetwork, /Checkout \$\{method\}/);

  assert.match(mxFixture, /MX Test Context/);
  assert.match(mxFixture, /Cart \$\{method\}/);
  assert.match(mxFixture, /Delivery \$\{method\}/);
  assert.match(mxFixture, /Payment \$\{method\}/);
  assert.match(mxFixture, /Order \$\{method\}/);
  assert.match(mxFixture, /attachNetworkEvidence/);

  // Registered MX QSTs use the auth fixture rather than mxQst.fixture. They must
  // receive the same curated business API evidence, especially SAM-25002 where
  // Checkout/Payment/Order are the core proof shown in Allure.
  assert.match(mxAuthFixture, /installBusinessNetworkEvidence/);
  assert.match(mxAuthFixture, /qstEvidenceEnabled/);
  assert.match(mxAuthFixture, /installBusinessNetworkEvidence\(page, testInfo, "MX"\)/);
});

test("destructive regional order flows publish or recover Order ID evidence", () => {
  const mxOrder = read("tests/markets/mx/qst/base-store/registered-order.spec.js");
  const clPayment = read("flows/cl/paymentFlows.js");
  const coOfficial = read("tests/markets/co/qst/base-store/official-p1.spec.js");
  const engine = read("reporting/allure/officialQstEnrichment.cjs");

  assert.match(mxOrder, /MX Order Evidence/);
  assert.match(mxOrder, /orderCode: result\.orderCode/);
  assert.match(clPayment, /CL Order Evidence/);
  assert.match(clPayment, /orderCode: result\.orderCode/);
  assert.match(coOfficial, /CO_QST_REGISTERED_ORDER/);
  assert.match(engine, /extractRuntimeOutputEvidence/);
  assert.match(engine, /orderPattern/);
});

test("network evidence and checkout data are sanitized before publication", () => {
  const sanitizer = read("reporting/evidence/sanitizer.js");
  const network = read("utils/networkEvidence.js");
  const dedupe = read("scripts/dedupe-allure-evidence.cjs");

  for (const key of ["security_?code", "postal_?code", "document", "identification", "vat_?number", "imei"]) {
    assert.ok(sanitizer.toLowerCase().includes(key.toLowerCase()), `sanitizer must include ${key}`);
  }
  assert.match(network, /return `\$\{url\.origin\}\$\{url\.pathname\}`/);
  assert.doesNotMatch(network, /searchParams/);
  assert.match(dedupe, /error\[ \._-\]\*context/i);
  assert.doesNotMatch(dedupe, /\/context\/i\.test\(name\)/);
});

test("shared enrichment can generate a sanitized contextual Allure result", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "allure-regional-"));
  const resultsDir = path.join(temp, "allure-results");
  const evidenceRoot = path.join(temp, "evidence", "phase-a");
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(evidenceRoot, { recursive: true });

  fs.writeFileSync(path.join(resultsDir, "one-result.json"), JSON.stringify({
    uuid: "one",
    name: "SAM-99999 @qst - Example checkout",
    fullName: "Example SAM-99999",
    status: "passed",
    labels: [], parameters: [], links: [], attachments: [], steps: [],
    start: Date.now(), stop: Date.now(),
  }));
  fs.writeFileSync(path.join(temp, "runtime-summary.json"), JSON.stringify({
    tests: [{ samId: "SAM-99999", status: "PASS" }],
  }));
  fs.writeFileSync(path.join(evidenceRoot, "qst-evidence.json"), JSON.stringify({
    tests: [{ zephyrId: "SAM-99999", sku: "SKU-123", orderCode: "MX261020-12345678", paymentMode: "Credit Card", email: "must-not-leak@example.com" }],
  }));

  const outcome = enrichOfficialQst({
    market: "MX", resultsDir, runtimeFile: path.join(temp, "runtime-summary.json"), evidenceRoot: path.join(temp, "evidence"),
    environment: "S2", store: "BASE_STORE", cases: { "SAM-99999": { store: "BS", title: "Example checkout" } }, auditedIds: ["SAM-99999"],
  });
  assert.equal(outcome.enriched, 1);
  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, "one-result.json"), "utf8"));
  assert.equal(result.parameters.find((item) => item.name === "SKU")?.value, "SKU-123");
  assert.equal(result.parameters.find((item) => item.name === "Order ID")?.value, "MX261020-12345678");
  assert.equal(result.parameters.find((item) => item.name === "Known Defect"), undefined);
  const contextAttachment = result.attachments.find((item) => item.name === "MX Test Context");
  assert.ok(contextAttachment);
  const context = fs.readFileSync(path.join(resultsDir, contextAttachment.source), "utf8");
  assert.doesNotMatch(context, /must-not-leak@example\.com/);
});
