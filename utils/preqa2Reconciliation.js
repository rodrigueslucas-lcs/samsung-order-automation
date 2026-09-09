const registry = require("../test-mapping/smb-qst.json");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { getPreqa2CampaignPlan, MARKET_ORDER } = require("./preqa2CampaignPlan");
const { validateS1OfficialImplementation } = require("./qstS1Implementation");

function reconcileMarket(market, { sourceLedger = defaultLedger, implementation } = {}) {
  const currentImplementation = implementation || validateS1OfficialImplementation();
  const plan = getPreqa2CampaignPlan(market, {
    sourceLedger,
    implementation: currentImplementation,
  });
  const marketImplementation = currentImplementation[market];
  const implemented = new Set(marketImplementation.implementedIds);
  const results = sourceLedger.markets?.[market]?.results || {};
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
      status,
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
    implementedCount: marketImplementation.implementedCount,
    executedCount: Object.keys(results).length,
    ...buckets,
  };
}

function reconcileAllMarkets({ sourceLedger = defaultLedger, implementation } = {}) {
  const currentImplementation = implementation || validateS1OfficialImplementation();
  return Object.fromEntries(MARKET_ORDER.map((market) => [market, reconcileMarket(market, {
    sourceLedger,
    implementation: currentImplementation,
  })]));
}

function reconciliationSummary(options = {}) {
  const all = reconcileAllMarkets(options);
  return Object.fromEntries(Object.entries(all).map(([market, item]) => [market, {
    officialTotal: item.officialTotal,
    implemented: item.implementedCount,
    executed: item.executedCount,
    passedWithAutomation: item.passImplemented.length,
    passedWithoutAutomation: item.passAutomationGap.length,
    failedWithAutomation: item.failImplemented.length,
    failedWithoutAutomation: item.failAutomationGap.length,
    pendingImplemented: item.notRunImplemented.length,
    pendingAutomationGap: item.notRunAutomationGap.length,
    blocked: item.blocked.length,
    notApplicable: item.notApplicable.length,
  }]));
}

module.exports = { reconcileAllMarkets, reconcileMarket, reconciliationSummary };
