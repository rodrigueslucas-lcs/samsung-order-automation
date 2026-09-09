const registry = require("../test-mapping/smb-qst.json");
const { metadataFor, normalizeMarket } = require("./preqa2CampaignPlan");
const { createValidationEntry } = require("./preqa2Validation");
const { validateResult } = require("./preqa2ValidationLedger");
const { sanitizeString } = require("../reporters/evidence/sanitizer");

function cleanOptional(value) {
  const text = value == null ? null : sanitizeString(String(value)).trim();
  return text || null;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"].includes(status)) {
    throw new Error(`Unsupported PreQA2 result status: ${value}`);
  }
  return status;
}

function buildRecordedResult({
  market,
  id,
  status,
  runtimeUrl = null,
  context = "unknown",
  evidence = null,
  blocker = null,
  automation = "not-assessed",
  validatedAt = new Date().toISOString(),
} = {}) {
  const code = normalizeMarket(market);
  const normalizedStatus = normalizeStatus(status);
  const metadata = metadataFor(code, id);
  const entry = createValidationEntry({
    market: code,
    id,
    title: metadata?.title || null,
    store: metadata?.store || "Unknown",
    feature: metadata?.feature || "Unknown",
    context,
    status: normalizedStatus,
    runtimeUrl,
    evidence: cleanOptional(evidence),
    automation: cleanOptional(automation) || "not-assessed",
    blocker: cleanOptional(blocker),
    validatedAt,
  });

  const persisted = {
    title: entry.title,
    store: entry.store,
    feature: entry.feature,
    context: entry.context,
    status: entry.status,
    runtimePath: entry.runtimePath,
    evidence: entry.evidence,
    automation: entry.automation,
    blocker: entry.blocker,
    validatedAt: entry.validatedAt,
  };
  const errors = validateResult(code, id, persisted);
  if (errors.length) throw new Error(errors.join("\n"));
  return persisted;
}

function applyResultToLedger(sourceLedger, market, id, recordedResult) {
  const code = normalizeMarket(market);
  if (!registry.markets[code].cases.includes(id)) {
    throw new Error(`${id} is not an official ${code} SMB QST ID.`);
  }
  const next = JSON.parse(JSON.stringify(sourceLedger));
  if (!next.markets?.[code]) throw new Error(`${code} ledger entry is missing.`);
  next.markets[code].results ||= {};
  next.markets[code].results[id] = recordedResult;
  const executed = Object.keys(next.markets[code].results).length;
  next.markets[code].status = executed === registry.markets[code].count ? "COMPLETE" : "ACTIVE";
  return next;
}

module.exports = {
  applyResultToLedger,
  buildRecordedResult,
  cleanOptional,
  normalizeStatus,
};
