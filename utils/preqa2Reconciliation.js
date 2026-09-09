const registry = require("../test-mapping/smb-qst.json");
const ledger = require("../test-mapping/preqa2-validation.json");
const { getPreqa2CampaignPlan, MARKET_ORDER } = require("./preqa2CampaignPlan");
const { validateS1OfficialImplementation } = require("./qstS1Implementation");

function reconcileMarket(market) {
  const plan = getPreqa2CampaignPlan(market);
  const implementation = validateS1OfficialImplementation()[market];
  const implemented = new Set(implementation.implementedIds);
  const results = ledger.markets?.[market]?.results || {};
  const buckets = {
    passImplemented: [],
    passAutomationGap: [],
    failImplemented: [],
    failAutomationGap: [],
    blocked: [],
    notApplicable: [],
    notRunImplemented: [],
    notRunAutomationGap: [],
  };

  for (const entry of plan.cases) {
    const status = results[entry.id]?.status || "NOT_RUN";
    const isImplemented = implemented.has(entry.id);
    const item = {
      id: entry.id,
      title: entry.title,
      store: entry.store,
      feature: entry.feature,
      baseline: entry.baseline,
      safety: entry.safety,
    };
    if (status === "PASS") {
      buckets[isImplemented ? "passImplemented" : "passAutomationGap"].push(item);
    } else if (status === "FAIL") {
      buckets[isImplemented ? "failImplemented" : "failAutomationGap"].push(item);
    } else if (status === "BLOCKED") {
      buckets.blocked.push(item);
    } else if (status === "NOT_APPLICABLE") {
      buckets.notApplicable.push(item);
    } else {
      buckets[isImplemented ? "notRunImplemented" : "notRunAutomationGap"].push(item);
    }
  }

  return {
    market,
    officialTotal: registry.markets[market].count,
    implementedCount: implementation.implementedCount,
    executedCount: Object.keys(results).length,
    ...buckets,
  };
}

function reconcileAllMarkets() {
  return Object.fromEntries(MARKET_ORDER.map((market) => [market, reconcileMarket(market)]));
}

function reconciliationSummary() {
  const all = reconcileAllMarkets();
  return Object.fromEntries(Object.entries(all).map(([market, item]) => [market, {
    officialTotal: item.officialTotal,
    implemented: item.implementedCount,
    executed: item.executedCount,
    passedWithoutAutomation: item.passAutomationGap.length,
    failedWithAutomation: item.failImplemented.length,
    pendingImplemented: item.notRunImplemented.length,
    pendingAutomationGap: item.notRunAutomationGap.length,
    blocked: item.blocked.length,
  }]));
}

module.exports = { reconcileAllMarkets, reconcileMarket, reconciliationSummary };
