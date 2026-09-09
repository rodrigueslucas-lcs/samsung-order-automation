const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const {
  validatePreqa2ValidationLedger,
  validateResult,
} = require("../utils/preqa2ValidationLedger");

const timestamp = "2026-09-09T20:00:00.000Z";

function emptyLedger() {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].status = "NOT_STARTED";
    ledger.markets[market].results = {};
  }
  return ledger;
}

function validResult(overrides = {}) {
  return {
    status: "PASS",
    context: "either",
    runtimePath: "/mx/",
    evidence: "Official Expected Result observed in PreQA2.",
    automation: "not-assessed",
    blocker: null,
    validatedAt: timestamp,
    ...overrides,
  };
}

test("PreQA2 validation ledger stays aligned to official SMB totals as execution grows", () => {
  const result = validatePreqa2ValidationLedger();
  assert.deepEqual(
    Object.fromEntries(Object.entries(result).map(([market, entry]) => [market, entry.officialTotal])),
    { MX: 37, CL: 38, CO: 35, PE: 34 }
  );
  for (const [market, entry] of Object.entries(result)) {
    assert.equal(entry.executed, Object.keys(defaultLedger.markets[market].results || {}).length);
    assert.equal(entry.status, defaultLedger.markets[market].status);
  }
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

test("executed result requires valid timestamp and allowed context", () => {
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

test("known registered official TCs cannot be recorded from WMC/either context", () => {
  const wrong = validateResult("MX", "SAM-24963", validResult({
    context: "either",
    runtimePath: "/mx/my-account/",
  }));
  assert.ok(wrong.some((error) => /requires registered Samsung Account context/.test(error)));

  const correct = validateResult("MX", "SAM-24963", validResult({
    context: "registered",
    runtimePath: "/mx/my-account/",
  }));
  assert.equal(correct.some((error) => /registered Samsung Account context/.test(error)), false);
});

test("known guest official TCs cannot be recorded from registered/either context", () => {
  const wrong = validateResult("MX", "SAM-24995", validResult({
    context: "registered",
    runtimePath: "/mx/checkout/",
  }));
  assert.ok(wrong.some((error) => /requires guest context/.test(error)));

  const correct = validateResult("MX", "SAM-24995", validResult({
    context: "guest",
    runtimePath: "/mx/checkout/",
  }));
  assert.equal(correct.some((error) => /requires guest context/.test(error)), false);
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
  const custom = emptyLedger();
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
