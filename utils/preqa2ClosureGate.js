const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { getPreqa2CampaignPlan, MARKET_ORDER } = require("./preqa2CampaignPlan");
const { validatePreqa2ValidationLedger } = require("./preqa2ValidationLedger");

function getMarketClosureState(market, { sourceLedger = defaultLedger } = {}) {
  validatePreqa2ValidationLedger(sourceLedger);
  const plan = getPreqa2CampaignPlan(market, { sourceLedger });
  const byStatus = { PASS: [], FAIL: [], BLOCKED: [], NOT_APPLICABLE: [], NOT_RUN: [] };
  const remaining = {
    safe: [],
    guarded: [],
    needsOfficialReview: [],
    registered: [],
    guest: [],
    epp: [],
  };

  for (const entry of plan.cases) {
    const status = entry.executionStatus;
    (byStatus[status] || byStatus.NOT_RUN).push(entry);
    if (status !== "NOT_RUN") continue;
    if (entry.safety === "safe-candidate") remaining.safe.push(entry);
    else if (entry.safety === "guarded-review") remaining.guarded.push(entry);
    else remaining.needsOfficialReview.push(entry);
    if (entry.requiresSamsungAccount) remaining.registered.push(entry);
    if (entry.requiresGuestState) remaining.guest.push(entry);
    if (entry.requiresEppContext) remaining.epp.push(entry);
  }

  return {
    market: plan.market,
    officialTotal: plan.officialTotal,
    executed: plan.executed,
    pending: plan.pending,
    passed: byStatus.PASS.length,
    failed: byStatus.FAIL.length,
    blocked: byStatus.BLOCKED.length,
    notApplicable: byStatus.NOT_APPLICABLE.length,
    remaining,
    byStatus,
    safeExhausted: remaining.safe.length === 0,
    registeredExhausted: remaining.registered.length === 0,
    eppExhausted: remaining.epp.length === 0,
    fullyAccounted: plan.pending === 0,
  };
}

function assertSafeCampaignExhausted(market, options = {}) {
  const state = getMarketClosureState(market, options);
  if (!state.safeExhausted) {
    const ids = state.remaining.safe.map((entry) => entry.id).join(", ");
    throw new Error(
      `${state.market} PreQA2 safe campaign is not exhausted: ${state.remaining.safe.length} safe official TC(s) remain NOT_RUN: ${ids}`
    );
  }
  return state;
}

function getAllMarketClosureStates({ sourceLedger = defaultLedger } = {}) {
  return Object.fromEntries(
    MARKET_ORDER.map((market) => [market, getMarketClosureState(market, { sourceLedger })])
  );
}

module.exports = {
  assertSafeCampaignExhausted,
  getAllMarketClosureStates,
  getMarketClosureState,
};
