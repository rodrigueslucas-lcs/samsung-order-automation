const registry = require("../test-mapping/smb-qst.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const mxPartialPlan = require("../test-mapping/mx-qst-partial-plan.json");
const peReusePlan = require("../test-mapping/pe-qst-reuse-plan.json");
const ledger = require("../test-mapping/preqa2-validation.json");
const { getSharedCandidatesByMarket } = require("./qstSharedCandidates");
const { validateS1OfficialImplementation } = require("./qstS1Implementation");

const MARKET_ORDER = Object.freeze(["MX", "CL", "CO", "PE"]);
const GUARDED_FEATURES = new Set(["Payment", "Order/BackOffice", "Order/Backoffice"]);

function normalizeMarket(value) {
  const market = String(value || "").trim().toUpperCase();
  if (!MARKET_ORDER.includes(market)) throw new Error(`Unsupported campaign market: ${value}`);
  return market;
}

function partialGroupById() {
  const map = new Map();
  for (const [group, entries] of Object.entries(mxPartialPlan.groups || {})) {
    for (const entry of entries) map.set(entry.id, group);
  }
  return map;
}

function metadataFor(market, id) {
  if (market === "MX") {
    const entry = mxCoverage.cases?.[id];
    return entry ? {
      title: entry.title,
      store: entry.store,
      feature: entry.feature,
      baseline: entry.coverage,
      notes: entry.notes,
    } : null;
  }
  if (market === "PE") {
    const entry = peReusePlan.cases?.[id];
    return entry ? {
      title: entry.title,
      store: entry.store,
      feature: entry.feature,
      baseline: entry.reuse,
      notes: entry.notes,
    } : null;
  }
  const shared = getSharedCandidatesByMarket(market).find((entry) => entry.id === id);
  return shared ? {
    title: shared.family,
    store: "Unknown",
    feature: shared.feature,
    baseline: "shared-core-candidate",
    notes: `Official ${market} ID belongs to shared family ${shared.family}; exact store, market data and runtime behavior must be confirmed from the official TC before execution.`,
  } : {
    title: null,
    store: "Unknown",
    feature: "Unknown",
    baseline: "official-unclassified",
    notes: "Official ID exists, but no case-level architecture metadata is currently populated for this market. Read the official TC before execution.",
  };
}

function safetyFor(meta) {
  if (!meta) return "needs-official-review";
  if (meta.baseline === "official-unclassified" || meta.feature === "Unknown") {
    return "needs-official-review";
  }
  if (GUARDED_FEATURES.has(meta.feature)) return "guarded-review";
  return "safe-candidate";
}

function priorityFor(market, id, meta, implemented, partialGroups) {
  if (market === "MX") {
    if (meta.baseline === "full") return 90;
    if (meta.store === "EPP") return 70;
    if (meta.baseline === "partial") {
      const group = partialGroups.get(id);
      return { quickAssertion: 10, existingFlowExtension: 20, newBusinessFlow: 30, eppContext: 70 }[group] ?? 35;
    }
    if (safetyFor(meta) === "safe-candidate") return 15;
    return 60;
  }
  if (market === "PE") {
    const order = { directCandidate: 10, extensionCandidate: 20, missing: 40, destructiveCandidate: 70 };
    return order[meta.baseline] ?? 50;
  }
  if (meta.baseline === "shared-core-candidate") return implemented ? 15 : 20;
  return 60;
}

function getPreqa2CampaignPlan(market) {
  const code = normalizeMarket(market);
  const officialIds = registry.markets[code].cases;
  const results = ledger.markets?.[code]?.results || {};
  const implementation = validateS1OfficialImplementation()[code];
  const implemented = new Set(implementation.implementedIds);
  const partialGroups = partialGroupById();

  const cases = officialIds.map((id) => {
    const meta = metadataFor(code, id);
    const execution = results[id] || null;
    return {
      id,
      market: code,
      title: meta?.title || null,
      store: meta?.store || "Unknown",
      feature: meta?.feature || "Unknown",
      baseline: meta?.baseline || "unknown",
      implemented: implemented.has(id),
      executionStatus: execution?.status || "NOT_RUN",
      safety: safetyFor(meta),
      priority: priorityFor(code, id, meta, implemented.has(id), partialGroups),
      notes: meta?.notes || null,
    };
  });

  cases.sort((a, b) =>
    (a.executionStatus === "NOT_RUN" ? 0 : 1) - (b.executionStatus === "NOT_RUN" ? 0 : 1) ||
    a.priority - b.priority ||
    a.id.localeCompare(b.id)
  );

  return {
    market: code,
    officialTotal: officialIds.length,
    executed: Object.keys(results).length,
    pending: officialIds.length - Object.keys(results).length,
    cases,
  };
}

function getCampaignSummary() {
  return Object.fromEntries(MARKET_ORDER.map((market) => {
    const plan = getPreqa2CampaignPlan(market);
    return [market, {
      officialTotal: plan.officialTotal,
      executed: plan.executed,
      pending: plan.pending,
      safeCandidates: plan.cases.filter((entry) => entry.executionStatus === "NOT_RUN" && entry.safety === "safe-candidate").length,
      guardedReview: plan.cases.filter((entry) => entry.executionStatus === "NOT_RUN" && entry.safety === "guarded-review").length,
      needsOfficialReview: plan.cases.filter((entry) => entry.executionStatus === "NOT_RUN" && entry.safety === "needs-official-review").length,
    }];
  }));
}

module.exports = {
  GUARDED_FEATURES,
  MARKET_ORDER,
  getCampaignSummary,
  getPreqa2CampaignPlan,
  metadataFor,
  normalizeMarket,
};
