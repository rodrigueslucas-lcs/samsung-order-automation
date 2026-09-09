const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getCampaignSummary,
  getPreqa2CampaignPlan,
  metadataFor,
} = require("../utils/preqa2CampaignPlan");

test("campaign plan covers all official IDs without inventing execution", () => {
  const mx = getPreqa2CampaignPlan("MX");
  const cl = getPreqa2CampaignPlan("CL");
  const co = getPreqa2CampaignPlan("CO");
  const pe = getPreqa2CampaignPlan("PE");
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

test("MX plan prioritizes safe Missing and quick Partial before EPP/guarded work", () => {
  const plan = getPreqa2CampaignPlan("MX");
  const byId = Object.fromEntries(plan.cases.map((entry) => [entry.id, entry]));
  assert.equal(byId["SAM-24968"].baseline, "missing");
  assert.equal(byId["SAM-24968"].safety, "safe-candidate");
  assert.ok(byId["SAM-24968"].priority < byId["SAM-25020"].priority);
  assert.ok(byId["SAM-24963"].priority < byId["SAM-25045"].priority);
  assert.equal(byId["SAM-25045"].store, "EPP");
});

test("PE plan preserves reuse classifications and guards payment/order review", () => {
  const plan = getPreqa2CampaignPlan("PE");
  const byId = Object.fromEntries(plan.cases.map((entry) => [entry.id, entry]));
  assert.equal(byId["SAM-25061"].baseline, "directCandidate");
  assert.equal(byId["SAM-25061"].safety, "safe-candidate");
  assert.equal(byId["SAM-25095"].baseline, "destructiveCandidate");
  assert.equal(byId["SAM-25095"].safety, "guarded-review");
});

test("CL and CO only use titles from verified shared families", () => {
  assert.equal(metadataFor("CL", "SAM-24784").title, "Login Home page");
  assert.equal(metadataFor("CO", "SAM-24873").title, "Login Home page");
  const unclassified = metadataFor("CL", "SAM-24866");
  assert.equal(unclassified.title, null);
  assert.equal(unclassified.baseline, "official-unclassified");
});

test("campaign summary keeps execution separate from planning candidates", () => {
  const summary = getCampaignSummary();
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary).map(([market, entry]) => [market, entry.officialTotal])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  assert.ok(summary.MX.safeCandidates > 0);
  assert.ok(summary.PE.guardedReview > 0);
});
