const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRun, executeRun } = require("../../scripts/run-epp-qst.cjs");
const { buildMatrix } = require("../../scripts/discover-epp-access.cjs");
test("EPP list discovery acquires no identity lock", () => {
  assert.equal(executeRun(buildRun("PE", ["--list"], {}), {
    acquire: () => { throw new Error("must not acquire"); }, spawn: () => ({ status: 0 }),
  }), 0);
});
for (const failure of [false, true]) test(`EPP campaign releases its own lease after ${failure ? "launch error" : "worker failure"}`, () => {
  let released = 0;
  const options = {
    acquire: config => { assert.equal(config.market, "CO"); return { env: { EPP_LEASE_TOKEN: "synthetic-lease" }, release: () => released++ }; },
    spawn: (_, __, options) => { assert.equal(options.env.EPP_LEASE_TOKEN, "synthetic-lease"); if (failure) throw new Error("fixture launch error"); return { status: 1 }; },
  };
  if (failure) assert.throws(() => executeRun(buildRun("CO", [], {}), options), /fixture launch error/);
  else assert.equal(executeRun(buildRun("CO", [], {}), options), 1);
  assert.equal(released, 1);
});
test("busy EPP identity never launches a competing campaign", () => {
  assert.throws(() => executeRun(buildRun("MX", [], {}), {
    acquire: () => { throw Object.assign(new Error("BUSY"), { code: "AUTH_BUSY" }); },
    spawn: () => { assert.fail("competing browser launched"); },
  }), /BUSY/);
});
for (const [market, count] of [["MX", 7], ["CO", 6], ["PE", 6], ["CL", 7]]) {
  test(`${market} EPP runner owns exactly ${count} official cases in both staging environments`, () => {
    for (const environment of ["S1", "S2"]) {
      const run = buildRun(market, ["--list"], { ENVIRONMENT: environment, MX_QST_TARGET_IDS: market === "MX" ? "SAM-25021" : "SAM-foreign" });
      assert.equal(run.ids.length, count);
      assert.equal(run.env.TEST_STORE, "EPP");
      assert.equal(run.env.ENVIRONMENT, environment);
      assert.ok(run.command.includes("--config=playwright.epp.config.js"));
      assert.ok(run.command.includes("--list"));
      assert.ok(run.command.includes(`tests/markets/${market.toLowerCase()}/qst/epp/`));
      if (market !== "MX") assert.equal(run.env.MX_QST_TARGET_IDS, undefined);
    }
  });
}
test("foreign SAMs and unsupported flags are rejected before launching a browser", () => {
  assert.throws(() => buildRun("PE", [], { PE_QST_TARGET_IDS: "SAM-25021" }), /outside/);
  assert.throws(() => buildRun("PE", ["--retries=2"], {}), /Unsupported/);
});
test("access discovery never converts observed gates into functional TC PASS", () => {
  const access = ["MX", "CO", "PE", "CL"].flatMap(market => ["S1", "S2"].map(environment => ({ market, environment, status: "READY", reason: "ACCESS_ONLY" })));
  const matrix = buildMatrix(access);
  assert.equal(matrix.length, 52);
  assert.equal(new Set(matrix.map(row => `${row.market}:${row.environment}:${row.tc}`)).size, 52);
  assert.ok(matrix.every(row => row.runtime === "NOT_RUN" && row.result === "NOT_RUN"));
});
