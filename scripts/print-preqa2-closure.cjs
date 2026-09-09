const { getAllMarketClosureStates, getMarketClosureState } = require("../utils/preqa2ClosureGate");

function printEntries(label, entries) {
  if (!entries.length) return;
  console.log(`  ${label} (${entries.length})`);
  for (const entry of entries) {
    console.log(`  - ${entry.id} | ${entry.store} | ${entry.feature} | ${entry.title || "title unavailable"}`);
  }
}

function printState(state) {
  console.log(
    `${state.market}: official=${state.officialTotal} executed=${state.executed} PASS=${state.passed} ` +
    `FAIL=${state.failed} BLOCKED=${state.blocked} N/A=${state.notApplicable} pending=${state.pending}`
  );
  console.log(
    `  remaining prerequisites: registered=${state.remaining.registered.length} ` +
    `guest=${state.remaining.guest.length} EPP=${state.remaining.epp.length}`
  );
  printEntries("SAFE NOT_RUN", state.remaining.safe);
  printEntries("REGISTERED NOT_RUN", state.remaining.registered);
  printEntries("GUEST NOT_RUN", state.remaining.guest);
  printEntries("EPP NOT_RUN", state.remaining.epp);
  printEntries("GUARDED NOT_RUN", state.remaining.guarded);
  printEntries("NEEDS OFFICIAL REVIEW", state.remaining.needsOfficialReview);
  for (const status of ["FAIL", "BLOCKED"]) {
    printEntries(status, state.byStatus[status] || []);
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
