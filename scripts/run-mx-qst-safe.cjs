const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { hasAuthState, hasVerifiedAuthState } = require("../utils/mxAuthState");
const preqa2Ledger = require("../test-mapping/preqa2-validation.json");
const { writeMxS1RuntimeResults } = require("../utils/mxS1RuntimeLedger");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { MX_BASE_P1_IDS, MX_BASE_P1_EXCLUSIONS } = require("../utils/mxQstScope.cjs");

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
const qstRoot = path.resolve("tests/markets/mx/qst/base-store");

const executionArtifacts = [
  path.resolve("playwright-report"),
  path.resolve("allure-report"),
  reportFile,
  runtimeSummaryFile,
  path.join(artifactDir, "playwright"),
  path.join(artifactDir, "evidence"),
  path.join(artifactDir, "executive"),
  allureResultsDir,
  allureReportDir,
];

if (!listOnly) {
  for (const target of executionArtifacts) fs.rmSync(target, { recursive: true, force: true });
  console.log("[mx-qst] Clean execution workspace prepared before authentication preflight.");
}

const officialP1Set = new Set(MX_BASE_P1_IDS);
const requestedTargetIds = String(process.env.MX_QST_TARGET_IDS || "")
  .split(/[\s,;]+/)
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const invalidTargetIds = requestedTargetIds.filter((id) => !officialP1Set.has(id));
if (invalidTargetIds.length) {
  console.error(`[mx-qst] Invalid targeted P1 SAM IDs: ${[...new Set(invalidTargetIds)].join(", ")}.`);
  console.error("[mx-qst] Targeted execution accepts only active official MX Base P1 IDs.");
  process.exit(2);
}
const selectedP1Ids = requestedTargetIds.length
  ? MX_BASE_P1_IDS.filter((id) => requestedTargetIds.includes(id))
  : [...MX_BASE_P1_IDS];
const targetedRun = selectedP1Ids.length !== MX_BASE_P1_IDS.length;
if (!selectedP1Ids.length) {
  console.error("[mx-qst] Targeted P1 selection is empty; QST execution was not started.");
  process.exit(2);
}
const selectedP1Set = new Set(selectedP1Ids);
const p1Pattern = `(?:${selectedP1Ids.join("|")})\\b`;
const activeP1Count = selectedP1Ids.length;

const allTitles = fs.readdirSync(qstRoot)
  .filter((name) => name.endsWith(".spec.js"))
  .flatMap((name) => testTitles(fs.readFileSync(path.join(qstRoot, name), "utf8")));
const fullOfficialP1Titles = allTitles.filter((title) => {
  const id = title.match(/SAM-\d+/)?.[0];
  return id && officialP1Set.has(id);
});
const fullTitleCounts = new Map(MX_BASE_P1_IDS.map((id) => [id, 0]));
for (const title of fullOfficialP1Titles) {
  const id = title.match(/SAM-\d+/)?.[0];
  fullTitleCounts.set(id, (fullTitleCounts.get(id) || 0) + 1);
}
const invalidP1Inventory = [...fullTitleCounts].filter(([, count]) => count !== 1);
if (fullOfficialP1Titles.length !== MX_BASE_P1_IDS.length || invalidP1Inventory.length) {
  console.error("[mx-qst] Active MX Base P1 inventory is invalid; QST execution was not started.");
  console.error(`Expected ${MX_BASE_P1_IDS.length} unique active P1 tests, found ${fullOfficialP1Titles.length}.`);
  for (const [id, count] of invalidP1Inventory) console.error(`  ${id}: ${count} test title(s)`);
  process.exit(1);
}

const officialP1Titles = fullOfficialP1Titles.filter((title) => {
  const id = title.match(/SAM-\d+/)?.[0];
  return id && selectedP1Set.has(id);
});
const officialTitlesById = Object.fromEntries(
  officialP1Titles.map((title) => [title.match(/SAM-\d+/)?.[0], title])
);
const destructiveTitles = officialP1Titles.filter((title) => /@destructive\b/i.test(title));
const selectionLabel = targetedRun ? "TARGETED P1" : "Base P1";
console.log(`[mx-qst] Active MX ${targetEnvironment} ${selectionLabel} selection: ${officialP1Titles.length}/${MX_BASE_P1_IDS.length} tests.`);
if (targetedRun) console.log(`[mx-qst] Target IDs: ${selectedP1Ids.join(", ")}`);
for (const exclusion of Object.values(MX_BASE_P1_EXCLUSIONS)) {
  console.log(`[mx-qst] Scope exclusion preserved for audit: ${exclusion.id} - ${exclusion.reason}`);
}

if (listOnly) {
  const listed = spawnSync(process.execPath, [
    playwrightCli, "test", "tests/markets/mx/qst/base-store",
    "--project=chromium", "--grep", p1Pattern, "--list", "--reporter=list",
  ], { stdio: "inherit" });
  process.exit(listed.status ?? 1);
}

if (useExistingAuth) {
  if (!hasAuthState()) {
    console.error("[mx-qst] Pre-provisioned MX auth state/session storage is missing; QST execution was not started.");
    process.exit(2);
  }
  console.log(`[mx-qst] Using pre-provisioned MX ${targetEnvironment} authentication state (CI mode).`);
  console.log("[mx-qst] Auth lifecycle: refresh + verify locally, upload Jenkins credentials, then run P1 directly. Do not place AUTH SAFE between upload and P1.");
} else if (hasVerifiedAuthState()) {
  console.log(`[mx-qst] Reusing verified MX ${targetEnvironment} authentication state; login bootstrap will not run again.`);
} else if (hasAuthState()) {
  console.error(`[mx-qst] MX ${targetEnvironment} auth files exist but are not verified for reuse. Run MX_QST_ENVIRONMENT=${targetEnvironment} npm run auth:verify:mx, then rerun QST.`);
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
  console.log(`[mx-qst] Fresh MX ${targetEnvironment} authentication state exported by the login bootstrap.`);
}

let authVerification = spawnSync(process.execPath, [path.resolve("scripts/auth-verify-mx.cjs")], {
  env: { ...process.env, MX_QST_ENVIRONMENT: targetEnvironment },
  stdio: "inherit",
});
if (authVerification.status !== 0) {
  if (useExistingAuth) {
    console.error(`[mx-qst] Pre-provisioned MX ${targetEnvironment} auth state is expired; QST execution was not started.`);
    process.exit(authVerification.status || 1);
  }
  const login = spawnSync(process.execPath, [path.resolve("scripts/auth-login-mx.cjs")], {
    env: { ...process.env, MX_QST_ENVIRONMENT: targetEnvironment, MX_AUTH_MANUAL: "1" },
    stdio: "inherit",
  });
  if (login.status !== 0 || !hasAuthState()) {
    console.error("[mx-qst] MX manual authentication refresh failed; QST execution was not started.");
    process.exit(login.status || 1);
  }
  authVerification = spawnSync(process.execPath, [path.resolve("scripts/auth-verify-mx.cjs")], {
    env: { ...process.env, MX_QST_ENVIRONMENT: targetEnvironment },
    stdio: "inherit",
  });
  if (authVerification.status !== 0) {
    console.error(`[mx-qst] Refreshed MX ${targetEnvironment} authentication did not validate; QST execution was not started.`);
    process.exit(authVerification.status || 1);
  }
}

// SAM-24986 is the only active P1 case that requires the dedicated second
// authenticated account. Do not spend time validating that credential when a
// targeted lane does not execute this scenario.
if (targetEnvironment === "S2" && selectedP1Set.has("SAM-24986")) {
  const suffix = targetEnvironment.toLowerCase();
  const secondAuthPath = path.resolve(`playwright/.auth/mx-${suffix}-second-user.json`);
  const secondSessionPath = path.resolve(`playwright/.auth/mx-${suffix}-second-session-storage.json`);
  if (!fs.existsSync(secondAuthPath) || !fs.existsSync(secondSessionPath)) {
    console.error(`[mx-qst] MX ${targetEnvironment} second-account auth/session files are missing; QST execution was not started.`);
    process.exit(2);
  }
  console.log(`[mx-qst] Verifying pre-provisioned MX ${targetEnvironment} second-account session for SAM-24986.`);
  const secondVerification = spawnSync(process.execPath, [path.resolve("scripts/auth-verify-mx.cjs")], {
    env: { ...process.env, MX_QST_ENVIRONMENT: targetEnvironment, MX_AUTH_SLOT: "second" },
    stdio: "inherit",
  });
  if (secondVerification.status !== 0) {
    console.error(`[mx-qst] Pre-provisioned MX ${targetEnvironment} second-account auth state is expired; QST execution was not started.`);
    process.exit(secondVerification.status || 1);
  }
}

const qstExecutionEnv = {
  ...process.env,
  PREQA2_CDP_URL: process.env.PREQA2_CDP_URL || "http://127.0.0.1:9223",
  ALLOW_PAYMENT_SUBMIT: "1",
  ALLOW_PROFILE_WRITE: process.env.ALLOW_PROFILE_WRITE ?? "1",
  TEST_ENV: environmentLabel,
  MX_QST_ENVIRONMENT: targetEnvironment,
  BACKOFFICE_ENV: targetEnvironment.toLowerCase(),
  TEST_MARKET: "MX",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "P1/QST",
  MX_QST_TRACKING_CREATE_ORDER: process.env.MX_QST_TRACKING_CREATE_ORDER || (targetEnvironment === "S2" ? "1" : "0"),
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.resolve("playwright-report"),
  SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  ALLURE_RESULTS_DIR: allureResultsDir,
};
console.log(`[mx-qst] PreQA2 CDP endpoint for SAM-24969: ${qstExecutionEnv.PREQA2_CDP_URL}`);

for (const target of executionArtifacts) fs.rmSync(target, { recursive: true, force: true });

// Keep the established one-worker full-P1 behavior. Registered/account/cart
// scenarios share state, so broad parallelism is intentionally not enabled
// until an isolated multi-worker lane is runtime-proven. Targeted execution is
// the safe speed-up for stabilization work.
const playwrightArgs = [
  playwrightCli, "test", "tests/markets/mx/qst/base-store",
  "--project=mx-auth-priority", "--project=chromium",
  "--workers=1", "--retries=0",
  "--grep", p1Pattern, "--output", path.join(artifactDir, "playwright"),
];
if (!headless) playwrightArgs.push("--headed");
console.log(`[mx-qst] Execution projects: mx-auth-priority -> chromium; workers=1; ${targetedRun ? "targeted stabilization" : "full official P1"}.`);

const result = spawnSync(process.execPath, playwrightArgs, {
  env: qstExecutionEnv,
  stdio: "inherit",
});

// Jenkins finalization already generates/publishes Allure HTML from the raw
// results. Avoid generating the same HTML twice in CI; local runs keep the
// convenience report exactly as before. Video capture is untouched.
if (!process.env.CI && process.env.ENABLE_ALLURE === "1" && fs.existsSync(allureResultsDir)) {
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
  const runtimeSummary = buildMxQstRuntimeSummary(report, {
    officialIds: selectedP1Ids,
    titles: officialTitlesById,
    environment: environmentLabel,
    suite: targetedRun ? "P1/QST TARGETED" : "P1/QST",
  });
  writeRuntimeSummary(runtimeSummaryFile, runtimeSummary);
  const outcomes = new Map(runtimeSummary.tests.map((entry) => [entry.samId, {
    status: entry.status,
    reason: entry.blockedReason || entry.error || "",
    title: entry.title || entry.samId,
  }]));
  console.log(`\nMX QST ${targetedRun ? "TARGETED" : "ACTIVE"} P1 TC SUMMARY`);
  for (const [id, outcome] of [...outcomes].sort()) {
    console.log(`${id}: ${outcome.status}${outcome.status === "SKIPPED-BLOCKED" && outcome.reason ? ` - ${outcome.reason.split("\n")[0]}` : ""}`);
  }
  const values = [...outcomes.values()];
  console.log(`Totals: selected=${activeP1Count} reported=${values.length} executed=${values.filter(({ status }) => !["SKIPPED-BLOCKED", "NOT_RUN"].includes(status)).length} passed=${values.filter(({ status }) => status === "PASS").length} failed=${values.filter(({ status }) => status === "FAIL").length} skipped=${values.filter(({ status }) => status === "SKIPPED-BLOCKED").length} notRun=${values.filter(({ status }) => status === "NOT_RUN").length}`);
  for (const status of ["PASS", "FAIL", "SKIPPED-BLOCKED", "NOT_RUN"]) {
    const ids = [...outcomes].filter(([, outcome]) => outcome.status === status).map(([id]) => id);
    console.log(`${status}: ${ids.join(", ") || "none"}`);
  }
  console.log(`Guarded destructive selected P1: ${destructiveTitles.length}`);
  for (const title of destructiveTitles) console.log(`  - ${title.match(/SAM-\d+/)?.[0] || title}`);
  const failing = [...outcomes].filter(([, { status }]) => status === "FAIL").map(([id]) => id);
  console.log(`Failing SAM IDs: ${failing.join(", ") || "none"}`);

  const stagingUpdates = [...outcomes]
    .filter(([id, outcome]) => outcome.status !== "NOT_RUN" && preqa2Ledger.markets.MX.results[id]?.status === "NOT_APPLICABLE")
    .map(([id, outcome]) => ({
      id,
      status: outcome.status === "SKIPPED-BLOCKED" ? "BLOCKED" : outcome.status,
      evidence: outcome.status === "PASS" ? `Active MX P1 QST runner completed: ${outcome.title}` : null,
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
