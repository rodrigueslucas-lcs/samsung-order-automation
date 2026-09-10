const { buildCycleReport } = require("../utils/officialSmbInventory");

const report = buildCycleReport();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`Official SMB priority source: ${report.sourceStatus}`);
if (report.blocker) console.log(`BLOCKER: ${report.blocker}`);
for (const [market, contexts] of Object.entries(report.markets)) {
  for (const [context, value] of Object.entries(contexts)) {
    console.log(`\n${market} ${context.replace("_", " ")}`);
    console.log(`Official=${value.official} P1/QST=${value.qst} P2=${value.p2} DST=${value.dst}`);
    console.log(`P1 coverage: full=${value.full} partial=${value.partial} missing=${value.missing}`);
    console.log(`P1 runtime: PASS=${value.runtimePass} FAIL=${value.runtimeFail} BLOCKED=${value.blocked} NOT_RUN=${value.notRun}`);
  }
}
