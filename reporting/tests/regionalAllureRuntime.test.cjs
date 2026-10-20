const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { enrichOfficialQst } = require("../allure/officialQstEnrichment.cjs");

function createResult(resultsDir, samId, title, status = "passed") {
  fs.writeFileSync(path.join(resultsDir, `${samId}-result.json`), JSON.stringify({
    uuid: samId,
    name: `${samId} @qst - ${title}`,
    fullName: `Synthetic ${samId}`,
    status,
    labels: [], parameters: [], links: [], attachments: [], steps: [],
    start: Date.now(), stop: Date.now(),
  }));
}

function parameter(result, name) {
  return result.parameters?.find((item) => item.name === name)?.value;
}

test("an open mapped Jira is not shown as Known Defect after the TC passes", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "allure-known-pass-"));
  const resultsDir = path.join(temp, "allure-results");
  fs.mkdirSync(resultsDir, { recursive: true });
  createResult(resultsDir, "SAM-24821", "Verify Back to Top", "passed");
  const runtimeFile = path.join(temp, "runtime-summary.json");
  fs.writeFileSync(runtimeFile, JSON.stringify({ tests: [{ samId: "SAM-24821", status: "PASS" }] }));

  enrichOfficialQst({
    market: "CL",
    resultsDir,
    runtimeFile,
    evidenceRoot: path.join(temp, "evidence"),
    environment: "S2",
    store: "BASE_STORE",
    cases: { "SAM-24821": { store: "BS", title: "Verify Back to Top" } },
    auditedIds: ["SAM-24821"],
  });

  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, "SAM-24821-result.json"), "utf8"));
  assert.equal(parameter(result, "Known Defect"), undefined);
  assert.ok(!result.links.some((link) => link.name === "RT-746043"));
  assert.doesNotMatch(result.description, /Known defect:/i);
});

test("the same mapped Jira is shown when the runtime status is BLOCKED", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "allure-known-blocked-"));
  const resultsDir = path.join(temp, "allure-results");
  fs.mkdirSync(resultsDir, { recursive: true });
  createResult(resultsDir, "SAM-24821", "Verify Back to Top", "skipped");
  const runtimeFile = path.join(temp, "runtime-summary.json");
  fs.writeFileSync(runtimeFile, JSON.stringify({ tests: [{ samId: "SAM-24821", status: "SKIPPED-BLOCKED", blockedReason: "RT-746043 Back to Top missing" }] }));

  enrichOfficialQst({
    market: "CL",
    resultsDir,
    runtimeFile,
    evidenceRoot: path.join(temp, "evidence"),
    environment: "S2",
    store: "BASE_STORE",
    cases: { "SAM-24821": { store: "BS", title: "Verify Back to Top" } },
    auditedIds: ["SAM-24821"],
  });

  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, "SAM-24821-result.json"), "utf8"));
  assert.equal(parameter(result, "Known Defect"), "RT-746043");
  assert.ok(result.links.some((link) => link.name === "RT-746043"));
  assert.match(result.description, /Known defect:/i);
});

test("CO Order ID is recovered from Playwright JSON stdout when legacy spec only logs it", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "allure-co-order-"));
  const resultsDir = path.join(temp, "allure-results");
  fs.mkdirSync(resultsDir, { recursive: true });
  createResult(resultsDir, "SAM-24912", "Complete card payment with registered user", "passed");
  const runtimeFile = path.join(temp, "runtime-summary.json");
  fs.writeFileSync(runtimeFile, JSON.stringify({ tests: [{ samId: "SAM-24912", status: "PASS" }] }));
  fs.writeFileSync(path.join(temp, "results.json"), JSON.stringify({
    suites: [{
      specs: [{
        title: "SAM-24912 @qst - Complete card payment with registered user",
        tests: [{ results: [{ stdout: [{ text: 'CO_QST_REGISTERED_ORDER {"orderCode":"CO261020-12345678","paymentMode":"co-mercadoCC","outcome":"CONFIRMATION"}' }] }] }],
      }],
      suites: [],
    }],
  }));

  enrichOfficialQst({
    market: "CO",
    resultsDir,
    runtimeFile,
    evidenceRoot: path.join(temp, "evidence"),
    environment: "S2",
    store: "BASE_STORE",
    cases: { "SAM-24912": { store: "BS", title: "Complete card payment with registered user", payment: true, registered: true } },
    auditedIds: ["SAM-24912"],
  });

  const result = JSON.parse(fs.readFileSync(path.join(resultsDir, "SAM-24912-result.json"), "utf8"));
  assert.equal(parameter(result, "Order ID"), "CO261020-12345678");
  assert.equal(parameter(result, "Payment"), "co-mercadoCC");
  assert.match(result.description, /CO261020-12345678/);
});
