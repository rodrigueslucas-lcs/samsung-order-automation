const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { hasAuthState } = require("../utils/mxAuthState");
const preqa2Ledger = require("../test-mapping/preqa2-validation.json");
const { writeMxS1RuntimeResults } = require("../utils/mxS1RuntimeLedger");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.MX_QST_ENVIRONMENT || "S1").toUpperCase();
if (!["S1", "S2"].includes(targetEnvironment)) throw new Error(`Unsupported MX QST environment: ${targetEnvironment}.`);
const environmentLabel = targetEnvironment === "S2" ? "S2/STG2" : "S1/STG";
const useExistingAuth = process.env.MX_QST_USE_EXISTING_AUTH === "1";
const headless = process.env.MX_QST_HEADLESS === "1";
const artifactDir = path.resolve(process.env.MX_QST_ARTIFACT_DIR || "test-results");
const reportFile = path.join(artifactDir, "mx-qst-safe-results.json");
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const allureResultsDir = path.join(artifactDir, "allure-results");
const allureReportDir = path.join(artifactDir, "allure-report");
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
const p1Pattern = `(?:${MX_BASE_P1_IDS.join("|")})\\b`;

const allTitles = fs.readdirSync(qstRoot)
  .filter((name) => name.endsWith(".spec.js"))
  .flatMap((name) => testTitles(fs.readFileSync(path.join(qstRoot, name), "utf8")));
const officialP1Titles = allTitles.filter((title) => {
  const id = title.match(/SAM-\d+/)?.[0];
  return id && p1Set.has(id);
});
const officialTitlesById = Object.fromEntries(officialP1Titles.map((title) => [title.match(/SAM-\d+/)?.[0], title]));
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
console.log(`[mx-qst] Official MX ${targetEnvironment} Base P1 selection: ${officialP1Titles.length}/30 tests.`);

if (listOnly) {
  const listed = spawnSync(process.execPath, [
    playwrightCli, "test", "tests/s1/mx/qst/base-store",
    "--project=chromium", "--grep", p1Pattern, "--list", "--reporter=list",
  ], { stdio: "inherit" });
  process.exit(listed.status ?? 1);
}

if (hasAuthState()) {
  console.log(`[mx-qst] Reusing validated MX ${targetEnvironment} authentication state.`);
} else if (useExistingAuth) {
  console.error("[mx-qst] Pre-provisioned MX auth state/session storage is missing; QST execution was not started.");
  process.exit(2);
} else {
  const login = spawnSync(process.execPath, [path.resolve("scripts/auth-login-mx.cjs")], {
    env: { ...process.env, MX_AUTH_MANUAL: "1" },
    stdio: "inherit",
  });
  if (login.status !== 0 || !hasAuthState()) {
    console.error("[mx-qst] MX manual authentication/bootstrap failed; QST execution was not started.");
    process.exit(login.status || 1);
  }
}

const qstExecutionEnv = {
  ...process.env,
  // SAM-24969 uses the already authenticated PreQA2 Chrome through CDP. Keep
  // this overridable for CI/alternate agents, but make the proven local port
  // part of the official runner so normal QST does not require a manual prefix.
  PREQA2_CDP_URL: process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223",
  ALLOW_PAYMENT_SUBMIT: "1",
  TEST_ENV: environmentLabel,
  MX_QST_ENVIRONMENT: targetEnvironment,
  TEST_MARKET: "MX",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "P1/QST",
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.resolve("playwright-report"),
  SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  ALLURE_RESULTS_DIR: allureResultsDir,
};
console.log(`[mx-qst] PreQA2 CDP endpoint for SAM-24969: ${qstExecutionEnv.PREQA2_CDP_URL}`);

// Only a real execution owns these official build artifacts. Removing stale
// output here prevents a cancelled build from publishing a previous/list report.
for (const target of [
  path.resolve("playwright-report"),
  reportFile,
  runtimeSummaryFile,
  path.join(artifactDir, "evidence"),
  path.join(artifactDir, "executive"),
  allureResultsDir,
  allureReportDir,
]) fs.rmSync(target, { recursive: true, force: true });

const playwrightArgs = [
  playwrightCli, "test", "tests/s1/mx/qst/base-store",
  "--project=chromium", "--workers=1", "--retries=0",
  "--grep", p1Pattern, "--output", path.join(artifactDir, "playwright"),
];
if (!headless) playwrightArgs.splice(4, 0, "--headed");

const result = spawnSync(process.execPath, playwrightArgs, {
  env: qstExecutionEnv,
  stdio: "inherit",
});

if (process.env.ENABLE_ALLURE === "1" && fs.existsSync(allureResultsDir)) {
  const allureCli = process.platform === "win32"
    ? path.resolve("node_modules/.bin/allure.cmd")
    : path.resolve("node_modules/.bin/allure");
  if (fs.existsSync(allureCli)) {
    const allure = spawnSync(allureCli, ["generate", allureResultsDir, "--clean", "-o", allureReportDir], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (allure.status !== 0) console.error("[mx-qst] Allure report generation failed; raw Allure results are preserved.");
    else console.log(`[mx-qst] Allure report generated: ${allureReportDir}`);
  } else {
    console.error("[mx-qst] Allure CLI is not installed; raw Allure results are preserved.");
  }
}

if (fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const runtimeSummary = buildMxQstRuntimeSummary(report, { officialIds: MX_BASE_P1_IDS, titles: officialTitlesById, environment: environmentLabel, suite: "P1/QST" });
  writeRuntimeSummary(runtimeSummaryFile, runtimeSummary);
  const outcomes = new Map(runtimeSummary.tests.map((entry) => [entry.samId, {
    status: entry.status,
    reason: entry.blockedReason || entry.error || "",
    title: entry.title || entry.samId,
  }]));
  console.log("\nMX QST OFFICIAL P1 TC SUMMARY");
  for (const [id, outcome] of [...outcomes].sort()) {
    console.log(`${id}: ${outcome.status}${outcome.status === "SKIPPED-BLOCKED" && outcome.reason ? ` - ${outcome.reason.split("\n")[0]}` : ""}`);
  }
  const values = [...outcomes.values()];
  console.log(`Totals: official=30 reported=${values.length} executed=${values.filter(({ status }) => !["SKIPPED-BLOCKED", "NOT_RUN"].includes(status)).length} passed=${values.filter(({ status }) => status === "PASS").length} failed=${values.filter(({ status }) => status === "FAIL").length} skipped=${values.filter(({ status }) => status === "SKIPPED-BLOCKED").length} notRun=${values.filter(({ status }) => status === "NOT_RUN").length}`);
  for (const status of ["PASS", "FAIL", "SKIPPED-BLOCKED", "NOT_RUN"]) {
    const ids = [...outcomes].filter(([, outcome]) => outcome.status === status).map(([id]) => id);
    console.log(`${status}: ${ids.join(", ") || "none"}`);
  }
  console.log(`Guarded destructive P1: ${destructiveTitles.length}`);
  for (const title of destructiveTitles) console.log(`  - ${title.match(/SAM-\d+/)?.[0] || title}`);
  const failing = [...outcomes].filter(([, { status }]) => status === "FAIL").map(([id]) => id);
  console.log(`Failing SAM IDs: ${failing.join(", ") || "none"}`);

  const stagingUpdates = [...outcomes]
    .filter(([id, outcome]) => outcome.status !== "NOT_RUN" && preqa2Ledger.markets.MX.results[id]?.status === "NOT_APPLICABLE")
    .map(([id, outcome]) => ({
      id,
      status: outcome.status === "SKIPPED-BLOCKED" ? "BLOCKED" : outcome.status,
      evidence: outcome.status === "PASS" ? `Official MX P1 QST runner completed: ${outcome.title}` : null,
      blocker: outcome.status === "SKIPPED-BLOCKED" ? outcome.reason.split("\n")[0] || `${targetEnvironment} prerequisite was not available.` : outcome.status === "FAIL" ? `MX ${targetEnvironment} functional assertion failed: ${outcome.title}` : null,
    }));
  if (targetEnvironment === "S1" && stagingUpdates.length) {
    writeMxS1RuntimeResults(stagingUpdates);
    console.log(`S1 runtime ledger reconciled: ${stagingUpdates.map(({ id }) => id).join(", ")}`);
  } else if (targetEnvironment === "S2") {
    console.log("S2 comparison run: S1 runtime ledger intentionally left unchanged.");
  }

  const executive = spawnSync(process.execPath, [
    path.resolve("reporters/executive-v3/generateExecutiveV3.cjs"),
    path.resolve("test-mapping/preqa2-validation.json"),
    path.join(artifactDir, "executive", "index.html"),
    path.join(artifactDir, "executive", "history.json"),
    runtimeSummaryFile,
  ], { stdio: "inherit" });
  if (executive.status !== 0) console.error("[mx-qst] Executive report generation failed; Playwright result is preserved.");
}

process.exitCode = result.status ?? 1;
