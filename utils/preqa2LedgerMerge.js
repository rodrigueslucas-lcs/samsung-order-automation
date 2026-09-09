const registry = require("../test-mapping/smb-qst.json");
const { validatePreqa2ValidationLedger } = require("./preqa2ValidationLedger");

const MARKET_ORDER = Object.freeze(["MX", "CL", "CO", "PE"]);

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function marketStatus(market, results) {
  const officialTotal = registry.markets[market].count;
  const executed = Object.keys(results || {}).length;
  if (executed === 0) return "NOT_STARTED";
  if (executed === officialTotal) return "COMPLETE";
  return "ACTIVE";
}

function newerResult(left, right) {
  const leftTime = Date.parse(left.validatedAt || "");
  const rightTime = Date.parse(right.validatedAt || "");
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return null;
  if (leftTime === rightTime) return null;
  return rightTime > leftTime ? right : left;
}

function mergeResult(market, id, left, right, { strategy = "error" } = {}) {
  if (!left) return clone(right);
  if (!right) return clone(left);
  if (deepEqual(left, right)) return clone(left);

  if (strategy === "prefer-incoming") return clone(right);
  if (strategy === "prefer-base") return clone(left);
  if (strategy === "prefer-newer") {
    const newer = newerResult(left, right);
    if (newer) return clone(newer);
  }

  throw new Error(
    `PreQA2 ledger conflict for ${market}/${id}: both ledgers contain different official results. ` +
    "Review the runtime evidence before choosing a result."
  );
}

function mergePreqa2Ledgers(baseLedger, incomingLedger, { strategy = "error" } = {}) {
  validatePreqa2ValidationLedger(baseLedger);
  validatePreqa2ValidationLedger(incomingLedger);

  const merged = clone(baseLedger);
  merged.environment = "PREQA2";
  merged.authority = baseLedger.authority || incomingLedger.authority;
  merged.policy = [...new Set([...(baseLedger.policy || []), ...(incomingLedger.policy || [])])];
  merged.markets = {};

  for (const market of MARKET_ORDER) {
    const baseResults = baseLedger.markets[market].results || {};
    const incomingResults = incomingLedger.markets[market].results || {};
    const results = {};
    const ids = new Set([...Object.keys(baseResults), ...Object.keys(incomingResults)]);

    for (const id of ids) {
      results[id] = mergeResult(market, id, baseResults[id], incomingResults[id], { strategy });
    }

    merged.markets[market] = {
      officialTotal: registry.markets[market].count,
      status: marketStatus(market, results),
      results,
    };
  }

  validatePreqa2ValidationLedger(merged);
  return merged;
}

function diffPreqa2Ledgers(baseLedger, incomingLedger) {
  validatePreqa2ValidationLedger(baseLedger);
  validatePreqa2ValidationLedger(incomingLedger);
  const report = {};

  for (const market of MARKET_ORDER) {
    const baseResults = baseLedger.markets[market].results || {};
    const incomingResults = incomingLedger.markets[market].results || {};
    const baseIds = new Set(Object.keys(baseResults));
    const incomingIds = new Set(Object.keys(incomingResults));
    const added = [...incomingIds].filter((id) => !baseIds.has(id)).sort();
    const removed = [...baseIds].filter((id) => !incomingIds.has(id)).sort();
    const changed = [...incomingIds]
      .filter((id) => baseIds.has(id) && !deepEqual(baseResults[id], incomingResults[id]))
      .sort();
    const unchanged = [...incomingIds]
      .filter((id) => baseIds.has(id) && deepEqual(baseResults[id], incomingResults[id]))
      .sort();
    report[market] = { added, removed, changed, unchanged };
  }

  return report;
}

module.exports = {
  MARKET_ORDER,
  diffPreqa2Ledgers,
  marketStatus,
  mergePreqa2Ledgers,
  mergeResult,
};
