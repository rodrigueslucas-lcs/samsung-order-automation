const registry = require("../test-mapping/smb-qst.json");
const { PREQA2_HOST } = require("./preqa2Config");

const PREQA2_VALIDATION_STATUSES = Object.freeze([
  "NOT_RUN",
  "PASS",
  "FAIL",
  "BLOCKED",
  "NOT_APPLICABLE",
]);

const PREQA2_CONTEXTS = Object.freeze(["guest", "registered", "either", "unknown"]);

function normalizeMarket(value) {
  const market = String(value || "").trim().toUpperCase();
  if (!registry.markets?.[market]) {
    throw new Error(`Unsupported SMB market: ${value}`);
  }
  return market;
}

function officialIds(market) {
  return [...registry.markets[normalizeMarket(market)].cases];
}

function sanitizeRuntimePath(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
  const url = new URL(raw, `https://${PREQA2_HOST}`);
  if (absolute && (url.protocol !== "https:" || url.hostname !== PREQA2_HOST)) {
    throw new Error(`PreQA2 runtime evidence URL must use https://${PREQA2_HOST}.`);
  }
  return url.pathname;
}

function assertOfficialId(market, id) {
  const code = normalizeMarket(market);
  if (!registry.markets[code].cases.includes(id)) {
    throw new Error(`${id} is not an official ${code} SMB QST ID.`);
  }
  return id;
}

function createValidationEntry({
  market,
  id,
  title = null,
  store = "Unknown",
  feature = "Unknown",
  context = "unknown",
  status = "NOT_RUN",
  runtimeUrl = null,
  evidence = null,
  automation = "not-assessed",
  blocker = null,
  validatedAt = null,
} = {}) {
  const code = normalizeMarket(market);
  assertOfficialId(code, id);
  if (!PREQA2_VALIDATION_STATUSES.includes(status)) {
    throw new Error(`Unsupported PreQA2 validation status: ${status}`);
  }
  if (!PREQA2_CONTEXTS.includes(context)) {
    throw new Error(`Unsupported PreQA2 validation context: ${context}`);
  }

  return {
    market: code,
    id,
    title,
    store,
    feature,
    environment: "PREQA2",
    context,
    status,
    runtimePath: sanitizeRuntimePath(runtimeUrl),
    evidence,
    automation,
    blocker,
    validatedAt,
  };
}

function createMarketMatrix(market, metadata = {}) {
  const code = normalizeMarket(market);
  return officialIds(code).map((id) => createValidationEntry({
    market: code,
    id,
    ...(metadata[id] || {}),
  }));
}

function summarizeMatrix(entries) {
  const summary = Object.fromEntries(PREQA2_VALIDATION_STATUSES.map((status) => [status, 0]));
  for (const entry of entries) {
    if (!PREQA2_VALIDATION_STATUSES.includes(entry.status)) {
      throw new Error(`Unsupported PreQA2 validation status in matrix: ${entry.status}`);
    }
    summary[entry.status] += 1;
  }
  return summary;
}

module.exports = {
  PREQA2_CONTEXTS,
  PREQA2_VALIDATION_STATUSES,
  assertOfficialId,
  createMarketMatrix,
  createValidationEntry,
  officialIds,
  sanitizeRuntimePath,
  summarizeMatrix,
};
