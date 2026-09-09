const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePreqa2ValidationLedger, validateResult } = require("../utils/preqa2ValidationLedger");

test("PreQA2 validation ledger stays aligned to official SMB totals", () => {
  const result = validatePreqa2ValidationLedger();
  assert.deepEqual(result, {
    MX: { officialTotal: 37, executed: 0, status: "ACTIVE" },
    CL: { officialTotal: 38, executed: 0, status: "NOT_STARTED" },
    CO: { officialTotal: 35, executed: 0, status: "NOT_STARTED" },
    PE: { officialTotal: 34, executed: 0, status: "NOT_STARTED" },
  });
});

test("PASS requires evidence and BLOCKED requires a blocker", () => {
  assert.match(validateResult("MX", "SAM-24968", { status: "PASS" })[0], /PASS requires/);
  assert.match(validateResult("MX", "SAM-24968", { status: "BLOCKED" })[0], /BLOCKED requires/);
});

test("runtime evidence path cannot leak query strings or cross markets", () => {
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    runtimePath: "/pe/cart",
  }).some((error) => /inside \/mx\//.test(error)));
  assert.ok(validateResult("MX", "SAM-24968", {
    status: "PASS",
    evidence: "filter changed product set",
    runtimePath: "/mx/cart?token=x",
  }).some((error) => /query strings/.test(error)));
});
