const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildStatusModel,
  generatePreqa2Status,
  renderStatusMarkdown,
} = require("../reporters/preqa2/generatePreqa2Status.cjs");

test("status model preserves official baseline and zero invented execution", () => {
  const model = buildStatusModel();
  assert.equal(model.total, 144);
  assert.equal(model.executed, 0);
  assert.equal(model.pass, 0);
  assert.equal(model.fail, 0);
  assert.equal(model.blocked, 0);
  assert.equal(model.markets.MX.officialTotal, 37);
  assert.equal(model.markets.PE.officialTotal, 34);
});

test("status markdown exposes campaign and automation backlog without fake PASS", () => {
  const markdown = renderStatusMarkdown(buildStatusModel());
  assert.match(markdown, /Official: 144 \| Executed: 0 \| PASS: 0/);
  assert.match(markdown, /Official review/);
  assert.match(markdown, /MX promotion candidates: 0/);
  assert.match(markdown, /No PASS is inferred/);
});

test("status generator writes ignored runtime artifact", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preqa2-status-"));
  const target = path.join(dir, "status.md");
  const result = generatePreqa2Status({ outputPath: target });
  assert.equal(result.outputPath, target);
  assert.ok(fs.readFileSync(target, "utf8").includes("Samsung SMB PreQA2 validation status"));
});
