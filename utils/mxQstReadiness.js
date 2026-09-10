const fs = require("node:fs");
const path = require("node:path");

const registry = require("../test-mapping/smb-qst.json");
const coverage = require("../test-mapping/mx-qst-coverage.json");
const ledger = require("../test-mapping/preqa2-validation.json");
const { collectMarketImplementation } = require("./qstS1Implementation");

const PREQA_SAFE_RUNNER = path.resolve("scripts/preqa2-safe-validation.cjs");

function idsFromPreqaRunner(file = PREQA_SAFE_RUNNER) {
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, "utf8");
  return [...new Set([...source.matchAll(/officialTcId:\s*["'`](SAM-\d+)["'`]/g)].map((match) => match[1]))];
}

function implementationIndex() {
  const byId = new Map();
  for (const item of collectMarketImplementation("MX")) {
    const current = byId.get(item.id) || [];
    current.push({ source: "qst-spec", spec: item.spec, test: item.title });
    byId.set(item.id, current);
  }
  for (const id of idsFromPreqaRunner()) {
    const current = byId.get(id) || [];
    current.push({
      source: "preqa-live-runner",
      spec: "scripts/preqa2-safe-validation.cjs",
      test: id,
    });
    byId.set(id, current);
  }
  return byId;
}

function targetEnvironment(runtime) {
  if (!runtime) return "UNRESOLVED";
  if (runtime.status === "NOT_APPLICABLE" && /Staging validation campaign/i.test(runtime.evidence || "")) {
    return "STAGING";
  }
  if (runtime.status === "BLOCKED" && /EPP/i.test(runtime.blocker || "")) return "EPP_CONTEXT";
  return "PREQA2";
}

function nextAction({ runtimeStatus, target, implemented, coverageState }) {
  if (runtimeStatus === "FAIL") return implemented ? "INVESTIGATE_LIVE_FAIL" : "IMPLEMENT_THEN_RETEST";
  if (runtimeStatus === "BLOCKED") return "RESOLVE_CONTEXT_BLOCKER";
  if (runtimeStatus === "NOT_APPLICABLE" && target === "STAGING") {
    return implemented ? "RUN_IN_STAGING" : "IMPLEMENT_FOR_STAGING";
  }
  if (runtimeStatus === "PASS") {
    if (!implemented) return "AUTOMATION_GAP_AFTER_PASS";
    if (coverageState === "missing") return "RECONCILE_COVERAGE_DRIFT";
    if (coverageState === "partial") return "REVIEW_EXPECTED_RESULT_COMPLETENESS";
    return "LIVE_PROVEN";
  }
  return implemented ? "RUN_IN_TARGET_ENVIRONMENT" : "IMPLEMENT";
}

function buildMxQstReadiness({ sourceLedger = ledger } = {}) {
  const officialIds = registry.markets?.MX?.cases || [];
  const implementation = implementationIndex();
  const results = sourceLedger.markets?.MX?.results || {};

  const cases = officialIds.map((id) => {
    const mapped = coverage.cases[id];
    const runtime = results[id] || null;
    const implementations = implementation.get(id) || [];
    const implemented = implementations.length > 0;
    const target = targetEnvironment(runtime);
    const coverageDrift = implemented && mapped?.coverage === "missing";

    return {
      id,
      title: mapped?.title || runtime?.title || "Unknown",
      store: mapped?.store || runtime?.store || "Unknown",
      feature: mapped?.feature || runtime?.feature || "Unknown",
      coverage: mapped?.coverage || "unmapped",
      implemented,
      implementations,
      runtimeStatus: runtime?.status || "NOT_RUN",
      preqa2Status: runtime?.status || "NOT_RUN",
      targetEnvironment: target,
      coverageDrift,
      nextAction: nextAction({
        runtimeStatus: runtime?.status || "NOT_RUN",
        target,
        implemented,
        coverageState: mapped?.coverage,
      }),
    };
  });

  const count = (predicate) => cases.filter(predicate).length;
  return {
    market: "MX",
    officialTotal: cases.length,
    summary: {
      implemented: count((item) => item.implemented),
      notImplemented: count((item) => !item.implemented),
      runtimePass: count((item) => item.runtimeStatus === "PASS"),
      runtimeFail: count((item) => item.runtimeStatus === "FAIL"),
      stagingRequired: count((item) => item.targetEnvironment === "STAGING"),
      eppContextBlocked: count((item) => item.targetEnvironment === "EPP_CONTEXT"),
      coverageDrift: count((item) => item.coverageDrift),
    },
    cases,
  };
}

module.exports = { buildMxQstReadiness, idsFromPreqaRunner, implementationIndex };
