const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { getPreqa2CampaignPlan } = require("../utils/preqa2CampaignPlan");
const { assertSafeCampaignExhausted, getMarketClosureState } = require("../utils/preqa2ClosureGate");

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

function resultFor(market, status = "PASS") {
  const code = market.toLowerCase();
  return {
    status,
    context: "either",
    runtimePath: `/${code}/`,
    evidence: status === "FAIL" ? "Official Expected Result was not observed." : "Official Expected Result observed in PreQA2.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: "2026-09-09T20:00:00.000Z",
  };
}

test("closure state exposes safe, guarded, auth, EPP and metadata-review work", () => {
  const state = getMarketClosureState("MX", { sourceLedger: emptyLedger() });
  assert.equal(state.officialTotal, 37);
  assert.equal(state.executed, 0);
  assert.equal(state.pending, 37);
  assert.ok(state.remaining.safe.length > 0);
  assert.ok(state.remaining.guarded.length > 0);
  assert.ok(state.remaining.registered.length > 0);
  assert.ok(state.remaining.guest.length > 0);
  assert.ok(state.remaining.epp.length > 0);
  assert.equal(state.safeExhausted, false);
  assert.equal(state.registeredExhausted, false);
  assert.equal(state.eppExhausted, false);
});

test("safe closure gate fails while an executable official TC remains NOT_RUN", () => {
  assert.throws(
    () => assertSafeCampaignExhausted("MX", { sourceLedger: emptyLedger() }),
    /safe campaign is not exhausted/
  );
});

test("safe closure gate passes once every safe candidate has an official result", () => {
  const sourceLedger = emptyLedger();
  const plan = getPreqa2CampaignPlan("MX", { sourceLedger });
  for (const entry of plan.cases.filter((item) => item.safety === "safe-candidate")) {
    sourceLedger.markets.MX.results[entry.id] = resultFor("MX");
  }
  sourceLedger.markets.MX.status = "ACTIVE";
  const state = assertSafeCampaignExhausted("MX", { sourceLedger });
  assert.equal(state.safeExhausted, true);
  assert.equal(state.remaining.safe.length, 0);
  assert.ok(state.pending > 0);
});

test("FAIL still counts as executed closure, not as an unexecuted safe candidate", () => {
  const sourceLedger = emptyLedger();
  const plan = getPreqa2CampaignPlan("MX", { sourceLedger });
  const safe = plan.cases.filter((item) => item.safety === "safe-candidate");
  safe.forEach((entry, index) => {
    sourceLedger.markets.MX.results[entry.id] = resultFor("MX", index === 0 ? "FAIL" : "PASS");
  });
  sourceLedger.markets.MX.status = "ACTIVE";
  const state = assertSafeCampaignExhausted("MX", { sourceLedger });
  assert.equal(state.failed, 1);
  assert.equal(state.safeExhausted, true);
});
