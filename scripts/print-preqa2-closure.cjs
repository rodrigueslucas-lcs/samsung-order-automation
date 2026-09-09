const { getAllMarketClosureStates, getMarketClosureState } = require("../utils/preqa2ClosureGate");

function printState(state) {
  console.log(
    `${state.market}: official=${state.officialTotal} executed=${state.executed} PASS=${state.passed} ` +
    `FAIL=${state.failed} BLOCKED=${state.blocked} N/A=${state.notApplicable} pending=${state.pending}`
  );
  for (const [label, entries] of [
    ["SAFE NOT_RUN", state.remaining.safe],
    ["GUARDED NOT_RUN", state.remaining.guarded],
    ["NEEDS OFFICIAL REVIEW", state.remaining.needsOfficialReview],
  ]) {
    if (!entries.length) continue;
    console.log(`  ${label} (${entries.length})`);
    for (const entry of entries) {
      console.log(
        `  - ${entry.id} | ${entry.store} | ${entry.feature} | ${entry.title || "title unavailable"}`
      );
    }
  }
  for (const status of ["FAIL", "BLOCKED"]) {
    const entries = state.byStatus[status] || [];
    if (!entries.length) continue;
    console.log(`  ${status} (${entries.length})`);
    for (const entry of entries) console.log(`  - ${entry.id} | ${entry.title || "title unavailable"}`);
  }
}

const requested = process.argv[2]?.trim().toUpperCase();
if (requested) {
  printState(getMarketClosureState(requested));
} else {
  const all = getAllMarketClosureStates();
  for (const market of ["MX", "CL", "CO", "PE"]) {
    printState(all[market]);
    console.log("");
  }
}
