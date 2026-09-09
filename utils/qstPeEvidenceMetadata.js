const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_PLAN_PATH = path.resolve("test-mapping/pe-qst-reuse-plan.json");

function readPlan(planPath = DEFAULT_PLAN_PATH) {
  return JSON.parse(fs.readFileSync(planPath, "utf8"));
}

function getPeQstEvidenceMetadata(zephyrId, { planPath = DEFAULT_PLAN_PATH } = {}) {
  const plan = readPlan(planPath);
  const entry = plan?.cases?.[zephyrId];
  if (!entry) {
    throw new Error(`PE QST evidence metadata was not found for ${zephyrId}.`);
  }

  return {
    zephyrId,
    market: "PE",
    store: entry.store,
    suite: "QST",
    feature: entry.feature,
    environment: "S1",
    officialTitle: entry.title,
    reuseCandidate: entry.reuse,
  };
}

module.exports = { getPeQstEvidenceMetadata };
