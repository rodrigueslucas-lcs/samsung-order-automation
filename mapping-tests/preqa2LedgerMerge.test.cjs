const test = require("node:test");
const assert = require("node:assert/strict");
const defaultLedger = require("../test-mapping/preqa2-validation.json");
const { diffPreqa2Ledgers, mergePreqa2Ledgers, marketStatus } = require("../utils/preqa2LedgerMerge");

function ledgerWith(entries = {}) {
  const ledger = JSON.parse(JSON.stringify(defaultLedger));
  for (const market of ["MX", "CL", "CO", "PE"]) {
    ledger.markets[market].results = {};
    ledger.markets[market].status = "NOT_STARTED";
  }
  for (const [market, results] of Object.entries(entries)) {
    ledger.markets[market].results = results;
    ledger.markets[market].status = Object.keys(results).length ? "ACTIVE" : "NOT_STARTED";
  }
  return ledger;
}

function result(status, validatedAt, evidence = "official expected result observed") {
  return {
    status,
    context: "either",
    runtimePath: "/mx/",
    evidence,
    automation: "not-assessed",
    blocker: null,
    validatedAt,
  };
}

test("merges independent official results without losing either execution", () => {
  const base = ledgerWith({ MX: {
    "SAM-24964": result("PASS", "2026-09-09T20:00:00.000Z"),
  }});
  const incoming = ledgerWith({ MX: {
    "SAM-24968": result("FAIL", "2026-09-09T20:05:00.000Z", "facets were unavailable"),
  }});
  const merged = mergePreqa2Ledgers(base, incoming);
  assert.equal(merged.markets.MX.status, "ACTIVE");
  assert.deepEqual(Object.keys(merged.markets.MX.results).sort(), ["SAM-24964", "SAM-24968"]);
});

test("identical result on both sides is not a conflict", () => {
  const shared = result("PASS", "2026-09-09T20:00:00.000Z");
  const merged = mergePreqa2Ledgers(
    ledgerWith({ MX: { "SAM-24964": shared } }),
    ledgerWith({ MX: { "SAM-24964": shared } })
  );
  assert.equal(merged.markets.MX.results["SAM-24964"].status, "PASS");
});

test("different official results fail closed by default", () => {
  const base = ledgerWith({ MX: {
    "SAM-24964": result("PASS", "2026-09-09T20:00:00.000Z"),
  }});
  const incoming = ledgerWith({ MX: {
    "SAM-24964": result("FAIL", "2026-09-09T20:10:00.000Z", "later run failed"),
  }});
  assert.throws(() => mergePreqa2Ledgers(base, incoming), /ledger conflict/);
});

test("prefer-newer only resolves when timestamps give an unambiguous winner", () => {
  const base = ledgerWith({ MX: {
    "SAM-24964": result("PASS", "2026-09-09T20:00:00.000Z"),
  }});
  const incoming = ledgerWith({ MX: {
    "SAM-24964": result("FAIL", "2026-09-09T20:10:00.000Z", "later run failed"),
  }});
  const merged = mergePreqa2Ledgers(base, incoming, { strategy: "prefer-newer" });
  assert.equal(merged.markets.MX.results["SAM-24964"].status, "FAIL");
});

test("diff reports added, removed, changed and unchanged IDs", () => {
  const unchanged = result("PASS", "2026-09-09T20:00:00.000Z");
  const base = ledgerWith({ MX: {
    "SAM-24964": unchanged,
    "SAM-24968": result("FAIL", "2026-09-09T20:05:00.000Z", "old"),
    "SAM-24969": result("PASS", "2026-09-09T20:06:00.000Z"),
  }});
  const incoming = ledgerWith({ MX: {
    "SAM-24964": unchanged,
    "SAM-24968": result("PASS", "2026-09-09T20:10:00.000Z", "new"),
    "SAM-24971": result("PASS", "2026-09-09T20:11:00.000Z"),
  }});
  const diff = diffPreqa2Ledgers(base, incoming).MX;
  assert.deepEqual(diff.added, ["SAM-24971"]);
  assert.deepEqual(diff.removed, ["SAM-24969"]);
  assert.deepEqual(diff.changed, ["SAM-24968"]);
  assert.deepEqual(diff.unchanged, ["SAM-24964"]);
});

test("market status is derived from result count", () => {
  assert.equal(marketStatus("MX", {}), "NOT_STARTED");
  assert.equal(marketStatus("MX", { "SAM-24964": {} }), "ACTIVE");
});
