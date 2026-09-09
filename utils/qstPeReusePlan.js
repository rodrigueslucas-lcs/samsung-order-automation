const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_REGISTRY_PATH = path.resolve("test-mapping/smb-qst.json");
const DEFAULT_PLAN_PATH = path.resolve("test-mapping/pe-qst-reuse-plan.json");
const ALLOWED_REUSE = new Set([
  "directCandidate",
  "extensionCandidate",
  "destructiveCandidate",
  "missing",
]);
const ALLOWED_STORES = new Set(["BS", "EPP"]);
const ALLOWED_FEATURES = new Set([
  "Auth/Home",
  "Product",
  "Cart",
  "Checkout",
  "Payment",
  "Order/BackOffice",
  "UI/Other",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validatePeQstReusePlan({
  registryPath = DEFAULT_REGISTRY_PATH,
  planPath = DEFAULT_PLAN_PATH,
} = {}) {
  const registry = readJson(registryPath);
  const plan = readJson(planPath);
  const official = registry?.markets?.PE?.cases || [];
  const planned = Object.keys(plan?.cases || {});

  if (plan.market !== "PE") throw new Error("PE reuse plan market must be PE.");
  if (plan.environmentTarget !== "S1") {
    throw new Error("PE reuse plan target environment must be S1.");
  }
  if (plan.officialTotal !== official.length) {
    throw new Error(
      `PE reuse plan officialTotal=${plan.officialTotal} does not match registry=${official.length}.`
    );
  }

  const officialSet = new Set(official);
  const plannedSet = new Set(planned);
  const missingIds = official.filter((id) => !plannedSet.has(id));
  const extraIds = planned.filter((id) => !officialSet.has(id));
  if (missingIds.length || extraIds.length) {
    throw new Error(
      `PE reuse plan must classify every official TC exactly once. Missing: ${missingIds.join(", ") || "none"}; ` +
        `extra: ${extraIds.join(", ") || "none"}.`
    );
  }

  const counts = Object.fromEntries([...ALLOWED_REUSE].map((key) => [key, 0]));
  for (const [id, entry] of Object.entries(plan.cases)) {
    if (!entry.title || !String(entry.title).trim()) {
      throw new Error(`${id} requires an official title.`);
    }
    if (!ALLOWED_STORES.has(entry.store)) {
      throw new Error(`${id} has invalid store: ${entry.store}`);
    }
    if (!ALLOWED_FEATURES.has(entry.feature)) {
      throw new Error(`${id} has invalid feature: ${entry.feature}`);
    }
    if (!ALLOWED_REUSE.has(entry.reuse)) {
      throw new Error(`${id} has invalid reuse classification: ${entry.reuse}`);
    }
    if (!entry.notes || !String(entry.notes).trim()) {
      throw new Error(`${id} requires reuse notes.`);
    }
    if (entry.reuse === "missing") {
      if (entry.candidate !== null) {
        throw new Error(`${id} is missing and must not point to a candidate spec.`);
      }
    } else if (!entry.candidate || !String(entry.candidate).startsWith("tests/s2/pe/qst/")) {
      throw new Error(`${id} reuse candidate must point to existing PE ST2 QST architecture.`);
    }
    counts[entry.reuse] += 1;
  }

  for (const [key, count] of Object.entries(counts)) {
    if (plan.summary?.[key] !== count) {
      throw new Error(
        `PE reuse summary ${key}=${plan.summary?.[key]} does not match classified=${count}.`
      );
    }
  }

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total !== official.length) {
    throw new Error(`PE reuse plan classified ${total}, expected ${official.length}.`);
  }

  return { officialTotal: official.length, ...counts };
}

module.exports = {
  ALLOWED_FEATURES,
  ALLOWED_REUSE,
  ALLOWED_STORES,
  validatePeQstReusePlan,
};
