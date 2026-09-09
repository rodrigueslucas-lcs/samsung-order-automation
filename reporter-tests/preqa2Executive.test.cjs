const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ledger = require("../test-mapping/preqa2-validation.json");
const {
  buildPreqa2Model,
  generatePreqa2Html,
  generatePreqa2Report,
} = require("../reporters/preqa2/generatePreqa2Report.cjs");

function ledgerCounts() {
  const results = Object.values(ledger.markets).flatMap((entry) => Object.values(entry.results || {}));
  return {
    executed: results.length,
    passed: results.filter((entry) => entry.status === "PASS").length,
    failed: results.filter((entry) => entry.status === "FAIL").length,
    blocked: results.filter((entry) => entry.status === "BLOCKED").length,
  };
}

test("PreQA2 dashboard preserves official 144 baseline and reflects recorded execution", () => {
  const model = buildPreqa2Model();
  const counts = ledgerCounts();
  assert.equal(model.total, 144);
  assert.equal(model.executed, counts.executed);
  assert.equal(model.passed, counts.passed);
  assert.equal(model.failed, counts.failed);
  assert.equal(model.blocked, counts.blocked);
  assert.equal(model.notRun, 144 - counts.executed);
  assert.deepEqual(
    Object.fromEntries(Object.entries(model.markets).map(([market, entry]) => [market, entry.officialTotal])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
});

test("PreQA2 dashboard keeps implementation count separate from official execution", () => {
  const model = buildPreqa2Model();
  assert.ok(model.markets.MX.implemented >= 10);
  assert.ok(model.markets.PE.implemented >= 21);
  assert.ok(model.markets.CL.implemented >= 1);
  assert.ok(model.markets.CO.implemented >= 1);
  assert.equal(
    model.markets.MX.executed,
    Object.keys(ledger.markets.MX.results || {}).length
  );
});

test("PreQA2 HTML clearly renders official authority without inventing results", () => {
  const model = buildPreqa2Model();
  const html = generatePreqa2Html(model);
  assert.match(html, /PreQA2 Official Validation/);
  assert.match(html, /Official SMB TCs: 144/);
  assert.match(html, />144<\/b>/);
  assert.match(html, /No PASS is inferred from navigation-only discovery/);
  if (model.failed === 0 && model.blocked === 0) {
    assert.match(html, /No PreQA2 failures or blockers recorded/);
  }
});

test("PreQA2 report writes standalone HTML", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preqa2-exec-"));
  const target = path.join(dir, "index.html");
  const result = generatePreqa2Report({ outputPath: target });
  assert.equal(result.outputPath, target);
  assert.ok(fs.statSync(target).size > 5000);
});
