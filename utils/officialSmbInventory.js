const inventory = require("../test-mapping/official-smb-inventory.json");

const MARKETS = Object.freeze(["MX", "PE", "CL", "CO"]);
const CONTEXTS = Object.freeze(["BASE_STORE", "EPP"]);
const PRIORITIES = Object.freeze(["P1", "P2"]);
const COVERAGE = Object.freeze(["full", "partial", "missing"]);
const RUNTIME = Object.freeze(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE", "NOT_RUN"]);

function cycleScope(priority) {
  if (priority === "P1") return { qstIncluded: true, dstIncluded: true };
  if (priority === "P2") return { qstIncluded: false, dstIncluded: true };
  throw new Error(`Unknown official priority: ${priority || "<missing>"}`);
}

function nextAction(row) {
  if (row.runtime?.status === "PASS") {
    if (!row.implemented) return "IMPLEMENT";
    if (row.coverage === "full") return "LIVE_PROVEN";
    return "REVIEW_EXPECTED_RESULT_COMPLETENESS";
  }
  if (row.runtime?.status === "FAIL") return "INVESTIGATE_LIVE_FAIL";
  if (row.runtime?.status === "BLOCKED") return "RESOLVE_CONTEXT_BLOCKER";
  if (!row.implemented) return "IMPLEMENT";
  if (row.coverage === "missing") return "RECONCILE_COVERAGE_DRIFT";
  if (row.environmentRequired === "EPP_CONTEXT") return "RUN_IN_EPP_CONTEXT";
  if (row.environmentRequired === "PREQA2") return "RUN_IN_PREQA2";
  if (row.environmentRequired === "STAGING" || row.environmentRequired === "S1") return "RUN_IN_STAGING";
  return "RUN_IN_TARGET_ENVIRONMENT";
}

function validateOfficialInventory(source = inventory, { requireSources = false } = {}) {
  const errors = [];
  const seen = new Set();
  let representedRows = 0;

  for (const market of MARKETS) {
    const marketData = source.markets?.[market];
    if (!marketData) {
      errors.push(`${market}: market is missing`);
      continue;
    }
    for (const context of CONTEXTS) {
      const contextData = marketData.contexts?.[context];
      if (!contextData) {
        errors.push(`${market}/${context}: context is missing`);
        continue;
      }
      if (requireSources && !contextData.source) errors.push(`${market}/${context}: official source is missing`);
      if (!Array.isArray(contextData.rows)) {
        errors.push(`${market}/${context}: rows must be an array`);
        continue;
      }
      if (contextData.source?.rowCount !== undefined && contextData.source.rowCount !== contextData.rows.length) {
        errors.push(`${market}/${context}: source rowCount ${contextData.source.rowCount} does not match represented rows ${contextData.rows.length}`);
      }
      contextData.rows.forEach((row, index) => {
        representedRows += 1;
        const location = `${market}/${context}/row-${index + 1}`;
        if (!row.sourceRowKey) errors.push(`${location}: sourceRowKey is required`);
        const key = `${market}/${context}/${row.officialId || row.sourceRowKey}`;
        if (seen.has(key)) errors.push(`${location}: duplicate official identity ${key}`);
        seen.add(key);
        if (!String(row.scenario || "").trim()) errors.push(`${location}: scenario is required`);
        if (!String(row.expectedResult || "").trim()) errors.push(`${location}: expectedResult is required`);
        if (!PRIORITIES.includes(row.priority)) errors.push(`${location}: invalid priority ${row.priority || "<missing>"}`);
        if (row.coverage && !COVERAGE.includes(row.coverage)) errors.push(`${location}: invalid coverage ${row.coverage}`);
        if (row.runtime?.status && !RUNTIME.includes(row.runtime.status)) errors.push(`${location}: invalid runtime status ${row.runtime.status}`);
        if (PRIORITIES.includes(row.priority)) {
          const derived = cycleScope(row.priority);
          if ("qstIncluded" in row && row.qstIncluded !== derived.qstIncluded) errors.push(`${location}: qstIncluded contradicts ${row.priority}`);
          if ("dstIncluded" in row && row.dstIncluded !== derived.dstIncluded) errors.push(`${location}: dstIncluded contradicts ${row.priority}`);
        }
      });
    }
  }

  if (errors.length) throw new Error(`Invalid official SMB inventory:\n${errors.join("\n")}`);
  return { representedRows, sourceStatus: source.sourceStatus };
}

function buildCycleReport(source = inventory) {
  validateOfficialInventory(source);
  const report = { sourceStatus: source.sourceStatus, blocker: source.sourceBlocker || null, markets: {}, aggregate: null };
  const aggregate = { official: 0, p1: 0, p2: 0, qst: 0, dst: 0, full: 0, partial: 0, missing: 0, implemented: 0, notImplemented: 0, runtimePass: 0, runtimeFail: 0, blocked: 0, notRun: 0 };

  for (const market of MARKETS) {
    report.markets[market] = {};
    for (const context of CONTEXTS) {
      const rows = source.markets[market].contexts[context].rows;
      const metrics = { official: rows.length, p1: 0, p2: 0, qst: 0, dst: 0, full: 0, partial: 0, missing: 0, implemented: 0, notImplemented: 0, runtimePass: 0, runtimeFail: 0, blocked: 0, notRun: 0 };
      for (const row of rows) {
        const scope = cycleScope(row.priority);
        metrics[row.priority.toLowerCase()] += 1;
        if (scope.qstIncluded) metrics.qst += 1;
        if (scope.dstIncluded) metrics.dst += 1;
        if (row.priority === "P1") {
          metrics[row.coverage || "missing"] += 1;
          metrics[row.implemented ? "implemented" : "notImplemented"] += 1;
          const status = row.runtime?.status || "NOT_RUN";
          if (status === "PASS") metrics.runtimePass += 1;
          else if (status === "FAIL") metrics.runtimeFail += 1;
          else if (status === "BLOCKED") metrics.blocked += 1;
          else if (status === "NOT_RUN") metrics.notRun += 1;
        }
      }
      report.markets[market][context] = {
        ...metrics,
        cases: rows.filter((row) => row.priority === "P1").map((row) => ({
          officialId: row.officialId || null,
          sourceRowKey: row.sourceRowKey,
          scenario: row.scenario,
          coverage: row.coverage || "missing",
          implemented: Boolean(row.implemented),
          runtimeStatus: row.runtime?.status || "NOT_RUN",
          environmentRequired: row.environmentRequired || "UNRESOLVED",
          blocker: row.blocker || null,
          nextAction: nextAction(row),
        })),
      };
      for (const key of Object.keys(aggregate)) aggregate[key] += metrics[key];
    }
  }
  report.aggregate = aggregate;
  return report;
}

module.exports = { MARKETS, CONTEXTS, PRIORITIES, cycleScope, nextAction, validateOfficialInventory, buildCycleReport };
