const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_PLAN_PATH = path.resolve("governance/pe-qst-reuse-plan.json");

function runtimeEnvironment(explicit) {
  const value = String(explicit || process.env.PE_QST_ENVIRONMENT || process.env.TEST_ENV || "S1").toUpperCase();
  return value.includes("S2") || value.includes("STG2") ? "S2" : "S1";
}

function readPlan(planPath = DEFAULT_PLAN_PATH) {
  return JSON.parse(fs.readFileSync(planPath, "utf8"));
}

function getPeQstEvidenceMetadata(zephyrId, { planPath = DEFAULT_PLAN_PATH, environment } = {}) {
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
    environment: runtimeEnvironment(environment),
    officialTitle: entry.title,
    reuseCandidate: entry.reuse,
  };
}

module.exports = { getPeQstEvidenceMetadata };
