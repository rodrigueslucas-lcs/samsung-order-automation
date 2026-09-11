const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { hasAuthState } = require("../utils/mxAuthState");
const preqa2Ledger = require("../test-mapping/preqa2-validation.json");
const { writeMxS1RuntimeResults } = require("../utils/mxS1RuntimeLedger");
const { testTitles } = require("../utils/qstS1Implementation");

const artifactDir = path.resolve(process.env.MX_QST_ARTIFACT_DIR || "test-results");
const reportFile = path.join(artifactDir, "mx-qst-safe-results.json");
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const qstRoot = path.resolve("tests/s1/mx/qst/base-store");
const destructiveTitles = fs.readdirSync(qstRoot)
  .filter((name) => name.endsWith(".spec.js"))
  .flatMap((name) => testTitles(fs.readFileSync(path.join(qstRoot, name), "utf8")))
  .filter((title) => /@destructive\b/i.test(title));

const login = spawnSync(process.execPath, [path.resolve("scripts/auth-login-mx.cjs")], {
  env: { ...process.env, MX_AUTH_MANUAL: "1" },
  stdio: "inherit",
});
if (login.status !== 0 || !hasAuthState()) {
  console.error("[mx-qst] MX manual authentication/bootstrap failed; safe QST execution was not started.");
  process.exit(login.status || 1);
}

const result = spawnSync(process.execPath, [
  playwrightCli, "test", "tests/s1/mx/qst/base-store",
  "--project=chromium", "--headed", "--workers=1", "--retries=0",
  "--grep-invert", "@destructive", "--reporter=list,json", "--output", path.join(artifactDir, "playwright"),
], {
  env: {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
    SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  },
  stdio: "inherit",
});

if (fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const outcomes = new Map();
  const blockedPattern = /SystemParking|maintenance|auth(?:enticated)? state|credentials? (?:are|is) required|EPERM|environment prerequisite/i;
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      const ids = [...new Set(spec.title.match(/SAM-\d+/g) || [])];
      const tests = spec.tests || [];
      const results = tests.flatMap((test) => test.results || []);
      const statuses = results.map(({ status }) => status);
      const reason = [
        ...tests.flatMap((test) => test.annotations || []).map(({ description }) => description),
        ...results.flatMap((entry) => entry.errors || []).map(({ message }) => message),
      ].filter(Boolean).join(" | ");
      const failed = statuses.some((value) => ["failed", "timedOut", "interrupted"].includes(value));
      const blocked = statuses.length && statuses.every((value) => value === "skipped") || failed && blockedPattern.test(reason);
      const status = blocked ? "SKIPPED-BLOCKED" : failed ? "FAIL" : "PASS";
      for (const id of ids) outcomes.set(id, { status, reason, title: spec.title });
    }
    for (const child of suite.suites || []) visit(child);
  };
  for (const suite of report.suites || []) visit(suite);
  console.log("\nMX QST SAFE TC SUMMARY");
  for (const [id, outcome] of [...outcomes].sort()) {
    console.log(`${id}: ${outcome.status}${outcome.status === "SKIPPED-BLOCKED" && outcome.reason ? ` - ${outcome.reason.split("\n")[0]}` : ""}`);
  }
  const values = [...outcomes.values()];
  console.log(`Totals: executed=${values.filter(({ status }) => status !== "SKIPPED-BLOCKED").length} passed=${values.filter(({ status }) => status === "PASS").length} failed=${values.filter(({ status }) => status === "FAIL").length} skipped=${values.filter(({ status }) => status === "SKIPPED-BLOCKED").length}`);
  for (const status of ["PASS", "FAIL", "SKIPPED-BLOCKED"]) {
    const ids = [...outcomes].filter(([, outcome]) => outcome.status === status).map(([id]) => id);
    console.log(`${status}: ${ids.join(", ") || "none"}`);
  }
  console.log(`Excluded destructive: ${destructiveTitles.length}`);
  for (const title of destructiveTitles) console.log(`  - ${title.match(/SAM-\d+|MX QST \d+(?:\s*\+\s*QST \d+)?/i)?.[0] || title}`);
  const failing = [...outcomes].filter(([, { status }]) => status === "FAIL").map(([id]) => id);
  console.log(`Failing SAM IDs: ${failing.join(", ") || "none"}`);

  const stagingUpdates = [...outcomes]
    .filter(([id]) => preqa2Ledger.markets.MX.results[id]?.status === "NOT_APPLICABLE")
    .map(([id, outcome]) => ({
      id,
      status: outcome.status === "SKIPPED-BLOCKED" ? "BLOCKED" : outcome.status,
      evidence: outcome.status === "PASS" ? `Safe MX S1 QST runner completed: ${outcome.title}` : null,
      blocker: outcome.status === "SKIPPED-BLOCKED" ? outcome.reason.split("\n")[0] || "S1 prerequisite was not available." : outcome.status === "FAIL" ? `MX S1 functional assertion failed: ${outcome.title}` : null,
    }));
  if (stagingUpdates.length) {
    writeMxS1RuntimeResults(stagingUpdates);
    console.log(`S1 runtime ledger reconciled: ${stagingUpdates.map(({ id }) => id).join(", ")}`);
  }
}

process.exitCode = result.status ?? 1;
