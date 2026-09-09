const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const {
  getCampaignSummary,
  getPreqa2CampaignPlan,
  metadataFor,
} = require("../utils/preqa2CampaignPlan");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

test("campaign plan covers all official IDs without depending on current live results", () => {
  const sourceLedger = emptyLedger();
  const mx = getPreqa2CampaignPlan("MX", { sourceLedger });
  const cl = getPreqa2CampaignPlan("CL", { sourceLedger });
  const co = getPreqa2CampaignPlan("CO", { sourceLedger });
  const pe = getPreqa2CampaignPlan("PE", { sourceLedger });
  assert.deepEqual(
    [mx.officialTotal, cl.officialTotal, co.officialTotal, pe.officialTotal],
    [37, 38, 35, 34]
  );
  for (const plan of [mx, cl, co, pe]) {
    assert.equal(plan.cases.length, plan.officialTotal);
    assert.equal(plan.executed, 0);
    assert.equal(plan.pending, plan.officialTotal);
    assert.ok(plan.cases.every((entry) => entry.executionStatus === "NOT_RUN"));
  }
});

test("campaign plan consumes official live results instead of reclassifying them", () => {
  const sourceLedger = emptyLedger();
  sourceLedger.markets.MX.status = "ACTIVE";
  sourceLedger.markets.MX.results["SAM-24964"] = {
    status: "PASS",
    context: "either",
    runtimePath: "/mx/smartphones/all-smartphones/",
    evidence: "GNB menu opened and navigated to the expected PreQA2 category.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: "2026-09-09T20:00:00.000Z",
  };
  const plan = getPreqa2CampaignPlan("MX", { sourceLedger });
  const current = plan.cases.find((entry) => entry.id === "SAM-24964");
  assert.equal(plan.executed, 1);
  assert.equal(plan.pending, 36);
  assert.equal(current.executionStatus, "PASS");
});

test("MX plan prioritizes safe Missing and quick Partial before EPP/guarded work", () => {
  const plan = getPreqa2CampaignPlan("MX", { sourceLedger: emptyLedger() });
  const byId = Object.fromEntries(plan.cases.map((entry) => [entry.id, entry]));
  assert.equal(byId["SAM-24968"].baseline, "missing");
  assert.equal(byId["SAM-24968"].safety, "safe-candidate");
  assert.ok(byId["SAM-24968"].priority < byId["SAM-25020"].priority);
  assert.ok(byId["SAM-24963"].priority < byId["SAM-25045"].priority);
  assert.equal(byId["SAM-25045"].store, "EPP");
});

test("PE plan preserves reuse classifications and guards payment/order review", () => {
  const plan = getPreqa2CampaignPlan("PE", { sourceLedger: emptyLedger() });
  const byId = Object.fromEntries(plan.cases.map((entry) => [entry.id, entry]));
  assert.equal(byId["SAM-25061"].baseline, "directCandidate");
  assert.equal(byId["SAM-25061"].safety, "safe-candidate");
  assert.equal(byId["SAM-25095"].baseline, "destructiveCandidate");
  assert.equal(byId["SAM-25095"].safety, "guarded-review");
});

test("CL and CO only use titles from verified shared families and keep store unknown", () => {
  const clLogin = metadataFor("CL", "SAM-24784");
  const coLogin = metadataFor("CO", "SAM-24873");
  assert.equal(clLogin.title, "Login Home page");
  assert.equal(coLogin.title, "Login Home page");
  assert.equal(clLogin.store, "Unknown");
  assert.equal(coLogin.store, "Unknown");

  const unclassified = metadataFor("CL", "SAM-24866");
  assert.equal(unclassified.title, null);
  assert.equal(unclassified.baseline, "official-unclassified");
  assert.equal(unclassified.store, "Unknown");
});

test("campaign summary keeps execution separate and exposes official-review backlog", () => {
  const summary = getCampaignSummary({ sourceLedger: emptyLedger() });
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary).map(([market, entry]) => [market, entry.officialTotal])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  assert.ok(summary.MX.safeCandidates > 0);
  assert.ok(summary.PE.guardedReview > 0);
  assert.ok(summary.CL.needsOfficialReview > 0);
  assert.ok(summary.CO.needsOfficialReview > 0);
});
