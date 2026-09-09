const ledger = require("../test-mapping/preqa2-validation.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const peReuse = require("../test-mapping/pe-qst-reuse-plan.json");

function resultFor(market, id) {
  return ledger.markets?.[market]?.results?.[id] || null;
}

function getMxPreqa2PromotionPlan() {
  const coverageReviewCandidates = [];
  const validationPassAutomationGap = [];
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
      automation: result.automation || "not-assessed",
    };

    if (result.status === "PASS") {
      if (coverage.coverage === "full") {
        retained.push({ ...common, action: "retain-full" });
      } else if (result.automation === "implemented-proven") {
        coverageReviewCandidates.push({
          ...common,
          action: `review-${coverage.coverage}-to-full`,
          reason: "Official Expected Result passed in PreQA2 and the recorder explicitly marks the persisted automation as implemented-proven.",
        });
      } else {
        validationPassAutomationGap.push({
          ...common,
          action: "official-pass-keep-coverage",
          reason: "Official TC PASS is valid, but automation coverage must remain independent until the persisted test itself is proven.",
        });
      }
    } else if (["FAIL", "BLOCKED"].includes(result.status)) {
      failedOrBlocked.push({ ...common, action: "review" });
    }
  }

  return {
    coverageReviewCandidates,
    validationPassAutomationGap,
    retained,
    failedOrBlocked,
  };
}

function getPePreqa2ValidationImpact() {
  const passed = [];
  const passedAutomationProven = [];
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
      automation: result.automation || "not-assessed",
    };
    if (result.status === "PASS") {
      passed.push(entry);
      if (result.automation === "implemented-proven") passedAutomationProven.push(entry);
    } else if (["FAIL", "BLOCKED"].includes(result.status)) {
      failedOrBlocked.push(entry);
    }
  }
  return { passed, passedAutomationProven, failedOrBlocked };
}

function getPreqa2PromotionSummary() {
  const mx = getMxPreqa2PromotionPlan();
  const pe = getPePreqa2ValidationImpact();
  return {
    MX: {
      coverageReviewCandidates: mx.coverageReviewCandidates.length,
      officialPassCoverageGap: mx.validationPassAutomationGap.length,
      retainedFull: mx.retained.length,
      failedOrBlocked: mx.failedOrBlocked.length,
    },
    PE: {
      officialPasses: pe.passed.length,
      automationProvenPasses: pe.passedAutomationProven.length,
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
