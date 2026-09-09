const ledger = require("../test-mapping/preqa2-validation.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const peReuse = require("../test-mapping/pe-qst-reuse-plan.json");

function resultFor(market, id) {
  return ledger.markets?.[market]?.results?.[id] || null;
}

function getMxPreqa2PromotionPlan() {
  const promotions = [];
  const retained = [];
  const failedOrBlocked = [];

  for (const [id, coverage] of Object.entries(mxCoverage.cases || {})) {
    const result = resultFor("MX", id);
    if (!result) continue;
    const common = {
      id,
      title: coverage.title,
      store: coverage.store,
      feature: coverage.feature,
      baselineCoverage: coverage.coverage,
      preqa2Status: result.status,
      evidence: result.evidence || null,
      runtimePath: result.runtimePath || null,
    };

    if (result.status === "PASS") {
      if (coverage.coverage === "full") retained.push({ ...common, action: "retain-full" });
      else promotions.push({ ...common, action: `promote-${coverage.coverage}-to-full` });
    } else if (["FAIL", "BLOCKED"].includes(result.status)) {
      failedOrBlocked.push({ ...common, action: "review" });
    }
  }

  return { promotions, retained, failedOrBlocked };
}

function getPePreqa2ValidationImpact() {
  const passed = [];
  const failedOrBlocked = [];
  for (const [id, baseline] of Object.entries(peReuse.cases || {})) {
    const result = resultFor("PE", id);
    if (!result) continue;
    const entry = {
      id,
      title: baseline.title,
      store: baseline.store,
      feature: baseline.feature,
      baselineReuse: baseline.reuse,
      preqa2Status: result.status,
      evidence: result.evidence || null,
      runtimePath: result.runtimePath || null,
    };
    if (result.status === "PASS") passed.push(entry);
    else if (["FAIL", "BLOCKED"].includes(result.status)) failedOrBlocked.push(entry);
  }
  return { passed, failedOrBlocked };
}

function getPreqa2PromotionSummary() {
  const mx = getMxPreqa2PromotionPlan();
  const pe = getPePreqa2ValidationImpact();
  return {
    MX: {
      promotionCandidates: mx.promotions.length,
      retainedFull: mx.retained.length,
      failedOrBlocked: mx.failedOrBlocked.length,
    },
    PE: {
      officialPasses: pe.passed.length,
      failedOrBlocked: pe.failedOrBlocked.length,
    },
  };
}

module.exports = {
  getMxPreqa2PromotionPlan,
  getPePreqa2ValidationImpact,
  getPreqa2PromotionSummary,
  resultFor,
};
