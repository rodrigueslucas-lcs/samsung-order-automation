const ledger = require("../test-mapping/preqa2-validation.json");
const registry = require("../test-mapping/smb-qst.json");
const { PREQA2_VALIDATION_STATUSES } = require("./preqa2Validation");

const MARKET_STATUSES = Object.freeze(["NOT_STARTED", "ACTIVE", "COMPLETE"]);

function validateResult(market, id, result) {
  const errors = [];
  if (!PREQA2_VALIDATION_STATUSES.includes(result.status) || result.status === "NOT_RUN") {
    errors.push(`${market}/${id}: result status must be PASS, FAIL, BLOCKED or NOT_APPLICABLE.`);
  }
  if (result.runtimePath && !String(result.runtimePath).startsWith(`/${market.toLowerCase()}/`)) {
    errors.push(`${market}/${id}: runtimePath must stay inside /${market.toLowerCase()}/.`);
  }
  if (/[?#]/.test(result.runtimePath || "")) {
    errors.push(`${market}/${id}: runtimePath must not retain query strings or fragments.`);
  }
  if (result.status === "PASS" && !String(result.evidence || "").trim()) {
    errors.push(`${market}/${id}: PASS requires runtime evidence summary.`);
  }
  if (result.status === "BLOCKED" && !String(result.blocker || "").trim()) {
    errors.push(`${market}/${id}: BLOCKED requires a concrete blocker.`);
  }
  return errors;
}

function validatePreqa2ValidationLedger() {
  const errors = [];
  if (ledger.environment !== "PREQA2") errors.push("Ledger environment must be PREQA2.");

  for (const [market, official] of Object.entries(registry.markets)) {
    const entry = ledger.markets?.[market];
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
    for (const [id, result] of Object.entries(entry.results || {})) {
      if (!official.cases.includes(id)) {
        errors.push(`${market}: ${id} is not an official SMB QST ID.`);
        continue;
      }
      errors.push(...validateResult(market, id, result));
    }
  }

  if (errors.length) {
    throw new Error(`Invalid PreQA2 validation ledger:\n${errors.join("\n")}`);
  }

  return Object.fromEntries(
    Object.entries(ledger.markets).map(([market, entry]) => [market, {
      officialTotal: entry.officialTotal,
      executed: Object.keys(entry.results || {}).length,
      status: entry.status,
    }])
  );
}

module.exports = { MARKET_STATUSES, validatePreqa2ValidationLedger, validateResult };
