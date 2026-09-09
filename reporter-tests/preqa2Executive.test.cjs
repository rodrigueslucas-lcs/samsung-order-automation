const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildPreqa2Model,
  generatePreqa2Html,
  generatePreqa2Report,
} = require("../reporters/preqa2/generatePreqa2Report.cjs");

test("PreQA2 dashboard starts from official 144 baseline with zero invented execution", () => {
  const model = buildPreqa2Model();
  assert.equal(model.total, 144);
  assert.equal(model.executed, 0);
  assert.equal(model.passed, 0);
  assert.equal(model.failed, 0);
  assert.equal(model.blocked, 0);
  assert.equal(model.notRun, 144);
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
  assert.equal(model.markets.MX.executed, 0);
});

test("PreQA2 HTML clearly renders official authority and no fake PASS", () => {
  const html = generatePreqa2Html(buildPreqa2Model());
  assert.match(html, /PreQA2 Official Validation/);
  assert.match(html, /Official SMB TCs: 144/);
  assert.match(html, />144<\/b>/);
  assert.match(html, /No PreQA2 failures or blockers recorded/);
  assert.match(html, /No PASS is inferred from navigation-only discovery/);
});

test("PreQA2 report writes standalone HTML", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preqa2-exec-"));
  const target = path.join(dir, "index.html");
  const result = generatePreqa2Report({ outputPath: target });
  assert.equal(result.outputPath, target);
  assert.ok(fs.statSync(target).size > 5000);
});
