const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const {
  buildStatusModel,
  generatePreqa2Status,
  renderStatusMarkdown,
} = require("../reporters/preqa2/generatePreqa2Status.cjs");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

function mxResult(status, evidence) {
  return {
    status,
    context: "either",
    runtimePath: "/mx/smartphones/all-smartphones/",
    evidence,
    automation: "not-assessed",
    blocker: status === "BLOCKED" ? evidence : null,
    validatedAt: "2026-09-09T20:00:00.000Z",
  };
}

test("status model preserves official 144 baseline independent of current repository evidence", () => {
  const model = buildStatusModel({ sourceLedger: emptyLedger() });
  assert.equal(model.total, 144);
  assert.equal(model.executed, 0);
  assert.equal(model.pass, 0);
  assert.equal(model.fail, 0);
  assert.equal(model.blocked, 0);
  assert.equal(model.markets.MX.officialTotal, 37);
  assert.equal(model.markets.PE.officialTotal, 34);
});

test("status model reports injected PASS and FAIL as official execution", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = mxResult("PASS", "GNB navigation met the Expected Result.");
  sourceLedger.markets.MX.results["SAM-24968"] = mxResult("FAIL", "No usable official facet/filter control was available.");
  const model = buildStatusModel({ sourceLedger });
  assert.equal(model.executed, 2);
  assert.equal(model.pass, 1);
  assert.equal(model.fail, 1);
  assert.equal(model.markets.MX.pending, 35);
});

test("status markdown exposes campaign and automation backlog without conflating coverage", () => {
  const markdown = renderStatusMarkdown(buildStatusModel({ sourceLedger: emptyLedger() }));
  assert.match(markdown, /Official: 144 \| Executed: 0 \| PASS: 0/);
  assert.match(markdown, /Official review/);
  assert.match(markdown, /MX coverage review candidates: 0/);
  assert.match(markdown, /official PASS with automation gap/i);
  assert.match(markdown, /Official PASS and automation coverage are intentionally independent/);
});

test("status generator writes runtime artifact from injected ledger", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preqa2-status-"));
  const target = path.join(dir, "status.md");
  const result = generatePreqa2Status({ outputPath: target, sourceLedger: emptyLedger() });
  assert.equal(result.outputPath, target);
  assert.ok(fs.readFileSync(target, "utf8").includes("Samsung SMB PreQA2 validation status"));
});
