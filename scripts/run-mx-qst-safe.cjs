const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { hasAuthState } = require("../utils/mxAuthState");
const preqa2Ledger = require("../test-mapping/preqa2-validation.json");
const { writeMxS1RuntimeResults } = require("../utils/mxS1RuntimeLedger");
const { testTitles } = require("../utils/qstS1Implementation");

const listOnly = process.argv.includes("--list");
const artifactDir = path.resolve(process.env.MX_QST_ARTIFACT_DIR || "test-results");
const reportFile = path.join(artifactDir, "mx-qst-safe-results.json");
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const qstRoot = path.resolve("tests/s1/mx/qst/base-store");

// Current Samsung MX Base Store P1/QST inventory. Helpers and non-P1 cases must
// not appear as independent tests in the official QST execution result.
const MX_BASE_P1_IDS = Object.freeze([
  "SAM-24962", "SAM-24963", "SAM-24964", "SAM-24968", "SAM-24969",
  "SAM-24971", "SAM-24972", "SAM-24975", "SAM-24981", "SAM-24982",
  "SAM-24985", "SAM-24986", "SAM-24988", "SAM-24989", "SAM-24990",
  "SAM-24991", "SAM-24992", "SAM-24993", "SAM-24994", "SAM-24995",
  "SAM-24999", "SAM-25000", "SAM-25001", "SAM-25002", "SAM-25004",
  "SAM-25005", "SAM-25006", "SAM-25010", "SAM-25011", "SAM-25016",
]);
const p1Set = new Set(MX_BASE_P1_IDS);
// Playwright --grep matches the full title path (file/describe/test), so the
// SAM ID is not guaranteed to be at character zero. Keep the word boundary to
// avoid partial ID matches while allowing the title path prefix.
const p1Pattern = `(?:${MX_BASE_P1_IDS.join("|")})\\b`;

const allTitles = fs.readdirSync(qstRoot)
  .filter((name) => name.endsWith(".spec.js"))
  .flatMap((name) => testTitles(fs.readFileSync(path.join(qstRoot, name), "utf8")));
const officialP1Titles = allTitles.filter((title) => {
  const id = title.match(/SAM-\d+/)?.[0];
  return id && p1Set.has(id);
});
const p1TitleCounts = new Map(MX_BASE_P1_IDS.map((id) => [id, 0]));
for (const title of officialP1Titles) {
  const id = title.match(/SAM-\d+/)?.[0];
  p1TitleCounts.set(id, (p1TitleCounts.get(id) || 0) + 1);
}
const invalidP1Inventory = [...p1TitleCounts].filter(([, count]) => count !== 1);
if (MX_BASE_P1_IDS.length !== 30 || officialP1Titles.length !== 30 || invalidP1Inventory.length) {
  console.error("[mx-qst] Official MX Base P1 selection is invalid; QST execution was not started.");
  console.error(`Expected 30 unique P1 tests, found ${officialP1Titles.length}.`);
  for (const [id, count] of invalidP1Inventory) console.error(`  ${id}: ${count} test title(s)`);
  process.exit(1);
}

const destructiveTitles = officialP1Titles.filter((title) => /@destructive\b/i.test(title));
console.log(`[mx-qst] Official MX Base P1 selection: ${officialP1Titles.length}/30 tests.`);

if (listOnly) {
  const listed = spawnSync(process.execPath, [
    playwrightCli, "test", "tests/s1/mx/qst/base-store",
    "--project=chromium", "--grep", p1Pattern, "--list",
  ], { stdio: "inherit" });
  process.exit(listed.status ?? 1);
}

const login = spawnSync(process.execPath, [path.resolve("scripts/auth-login-mx.cjs")], {
  env: { ...process.env, MX_AUTH_MANUAL: "1" },
  stdio: "inherit",
});
if (login.status !== 0 || !hasAuthState()) {
  console.error("[mx-qst] MX manual authentication/bootstrap failed; QST execution was not started.");
  process.exit(login.status || 1);
}

const result = spawnSync(process.execPath, [
  playwrightCli, "test", "tests/s1/mx/qst/base-store",
  "--project=chromium", "--headed", "--workers=1", "--retries=0",
  "--grep", p1Pattern, "--reporter=list,json", "--output", path.join(artifactDir, "playwright"),
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
      const ids = [...new Set(spec.title.match(/SAM-\d+/g) || [])].filter((id) => p1Set.has(id));
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
  console.log("\nMX QST OFFICIAL P1 TC SUMMARY");
  for (const [id, outcome] of [...outcomes].sort()) {
    console.log(`${id}: ${outcome.status}${outcome.status === "SKIPPED-BLOCKED" && outcome.reason ? ` - ${outcome.reason.split("\n")[0]}` : ""}`);
  }
  const values = [...outcomes.values()];
  console.log(`Totals: official=30 reported=${values.length} executed=${values.filter(({ status }) => status !== "SKIPPED-BLOCKED").length} passed=${values.filter(({ status }) => status === "PASS").length} failed=${values.filter(({ status }) => status === "FAIL").length} skipped=${values.filter(({ status }) => status === "SKIPPED-BLOCKED").length}`);
  for (const status of ["PASS", "FAIL", "SKIPPED-BLOCKED"]) {
    const ids = [...outcomes].filter(([, outcome]) => outcome.status === status).map(([id]) => id);
    console.log(`${status}: ${ids.join(", ") || "none"}`);
  }
  console.log(`Guarded destructive P1: ${destructiveTitles.length}`);
  for (const title of destructiveTitles) console.log(`  - ${title.match(/SAM-\d+/)?.[0] || title}`);
  const failing = [...outcomes].filter(([, { status }]) => status === "FAIL").map(([id]) => id);
  console.log(`Failing SAM IDs: ${failing.join(", ") || "none"}`);

  const stagingUpdates = [...outcomes]
    .filter(([id]) => preqa2Ledger.markets.MX.results[id]?.status === "NOT_APPLICABLE")
    .map(([id, outcome]) => ({
      id,
      status: outcome.status === "SKIPPED-BLOCKED" ? "BLOCKED" : outcome.status,
      evidence: outcome.status === "PASS" ? `Official MX P1 QST runner completed: ${outcome.title}` : null,
      blocker: outcome.status === "SKIPPED-BLOCKED" ? outcome.reason.split("\n")[0] || "S1 prerequisite was not available." : outcome.status === "FAIL" ? `MX S1 functional assertion failed: ${outcome.title}` : null,
    }));
  if (stagingUpdates.length) {
    writeMxS1RuntimeResults(stagingUpdates);
    console.log(`S1 runtime ledger reconciled: ${stagingUpdates.map(({ id }) => id).join(", ")}`);
  }
}

process.exitCode = result.status ?? 1;
