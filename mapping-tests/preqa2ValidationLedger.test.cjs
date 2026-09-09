const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePreqa2ValidationLedger,
  validateResult,
} = require("../utils/preqa2ValidationLedger");

const timestamp = "2026-09-09T20:00:00.000Z";

test("PreQA2 validation ledger stays aligned to official SMB totals", () => {
  const result = validatePreqa2ValidationLedger();
  assert.deepEqual(result, {
    MX: { officialTotal: 37, executed: 0, status: "ACTIVE" },
    CL: { officialTotal: 38, executed: 0, status: "NOT_STARTED" },
    CO: { officialTotal: 35, executed: 0, status: "NOT_STARTED" },
    PE: { officialTotal: 34, executed: 0, status: "NOT_STARTED" },
  });
});

test("PASS FAIL and NOT_APPLICABLE require evidence; BLOCKED requires blocker", () => {
  assert.ok(validateResult("MX", "SAM-24968", { status: "PASS", validatedAt: timestamp })
    .some((error) => /PASS requires runtime evidence/.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", { status: "FAIL", validatedAt: timestamp })
    .some((error) => /FAIL requires runtime evidence/.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", { status: "NOT_APPLICABLE", validatedAt: timestamp })
    .some((error) => /NOT_APPLICABLE requires runtime evidence/.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", { status: "BLOCKED", validatedAt: timestamp })
    .some((error) => /BLOCKED requires a concrete blocker/.test(error)));
});

test("executed result requires valid timestamp and context", () => {
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    context: "guest",
  }).some((error) => /validatedAt/.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    validatedAt: timestamp,
    context: "admin",
  }).some((error) => /unsupported context/.test(error)));
});

test("runtime evidence path cannot leak query strings or cross markets", () => {
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    validatedAt: timestamp,
    runtimePath: "/pe/cart",
  }).some((error) => /inside \/mx\//.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    validatedAt: timestamp,
    runtimePath: "/mx/cart?token=x",
  }).some((error) => /query strings/.test(error)));
});

test("custom ledgers are validated instead of silently using the imported default", () => {
  const custom = JSON.parse(JSON.stringify(require("../test-mapping/preqa2-validation.json")));
  custom.markets.MX.results["SAM-24968"] = {
    status: "PASS",
    context: "guest",
    runtimePath: "/mx/smartphones/",
    evidence: "Facet result set changed.",
    validatedAt: timestamp,
  };
  custom.markets.MX.status = "ACTIVE";
  const result = validatePreqa2ValidationLedger(custom);
  assert.equal(result.MX.executed, 1);
});
