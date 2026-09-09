const ledger = require("../test-mapping/preqa2-validation.json");
const registry = require("../test-mapping/smb-qst.json");
const {
  PREQA2_CONTEXTS,
  PREQA2_VALIDATION_STATUSES,
} = require("./preqa2Validation");
const { getExecutionRequirement } = require("./preqa2ExecutionRequirements");

const MARKET_STATUSES = Object.freeze(["NOT_STARTED", "ACTIVE", "COMPLETE"]);
const EXECUTED_STATUSES = new Set(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);

function validateIsoTimestamp(value) {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(String(value));
}

function validateResult(market, id, result) {
  const errors = [];
  if (!PREQA2_VALIDATION_STATUSES.includes(result.status) || result.status === "NOT_RUN") {
    errors.push(`${market}/${id}: result status must be PASS, FAIL, BLOCKED or NOT_APPLICABLE.`);
  }
  if (!PREQA2_CONTEXTS.includes(result.context || "unknown")) {
    errors.push(`${market}/${id}: unsupported context ${result.context}.`);
  }

  if (EXECUTED_STATUSES.has(result.status)) {
    const requirement = getExecutionRequirement(market, id);
    if (requirement.requiresSamsungAccount && result.context !== "registered") {
      errors.push(`${market}/${id}: official TC requires registered Samsung Account context.`);
    }
    if (requirement.requiresGuestState && result.context !== "guest") {
      errors.push(`${market}/${id}: official TC requires guest context.`);
    }
  }

  if (result.runtimePath && !String(result.runtimePath).startsWith(`/${market.toLowerCase()}/`)) {
    errors.push(`${market}/${id}: runtimePath must stay inside /${market.toLowerCase()}/.`);
  }
  if (/[?#]/.test(result.runtimePath || "")) {
    errors.push(`${market}/${id}: runtimePath must not retain query strings or fragments.`);
  }
  if (EXECUTED_STATUSES.has(result.status) && !validateIsoTimestamp(result.validatedAt)) {
    errors.push(`${market}/${id}: executed result requires a valid validatedAt ISO timestamp.`);
  }
  if (["PASS", "FAIL", "NOT_APPLICABLE"].includes(result.status) && !String(result.evidence || "").trim()) {
    errors.push(`${market}/${id}: ${result.status} requires runtime evidence summary.`);
  }
  if (result.status === "BLOCKED" && !String(result.blocker || "").trim()) {
    errors.push(`${market}/${id}: BLOCKED requires a concrete blocker.`);
  }
  return errors;
}

function validatePreqa2ValidationLedger(sourceLedger = ledger) {
  const errors = [];
  if (sourceLedger.environment !== "PREQA2") errors.push("Ledger environment must be PREQA2.");

  for (const [market, official] of Object.entries(registry.markets)) {
    const entry = sourceLedger.markets?.[market];
    if (!entry) {
      errors.push(`${market}: missing PreQA2 market ledger.`);
      continue;
    }
    if (entry.officialTotal !== official.count) {
      errors.push(`${market}: officialTotal must be ${official.count}.`);
    }
    if (!MARKET_STATUSES.includes(entry.status)) {
      errors.push(`${market}: unsupported market status ${entry.status}.`);
    }
    const resultEntries = Object.entries(entry.results || {});
    for (const [id, result] of resultEntries) {
      if (!official.cases.includes(id)) {
        errors.push(`${market}: ${id} is not an official SMB QST ID.`);
        continue;
      }
      errors.push(...validateResult(market, id, result));
    }
    const executed = resultEntries.length;
    if (entry.status === "NOT_STARTED" && executed > 0) {
      errors.push(`${market}: NOT_STARTED market cannot contain executed results.`);
    }
    if (entry.status === "COMPLETE" && executed !== official.count) {
      errors.push(`${market}: COMPLETE market requires all ${official.count} official results.`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid PreQA2 validation ledger:\n${errors.join("\n")}`);
  }

  return Object.fromEntries(
    Object.entries(sourceLedger.markets).map(([market, entry]) => [market, {
      officialTotal: entry.officialTotal,
      executed: Object.keys(entry.results || {}).length,
      status: entry.status,
    }])
  );
}

module.exports = {
  EXECUTED_STATUSES,
  MARKET_STATUSES,
  validateIsoTimestamp,
  validatePreqa2ValidationLedger,
  validateResult,
};
