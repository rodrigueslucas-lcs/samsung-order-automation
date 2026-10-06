const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const reusePlan = require("../governance/co-qst-plan.json");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { getCoQstConfig } = require("../config/markets/co");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(targetEnvironment)) throw new Error(`Unsupported CO QST environment: ${targetEnvironment}.`);

const configEnv = {
  ...process.env,
  CO_QST_ENVIRONMENT: targetEnvironment,
  CO_STOREFRONT_URL: process.env.CO_STOREFRONT_URL || (targetEnvironment === "S2"
    ? "https://stg2.shop.samsung.com/co/"
    : "https://stg.shop.samsung.com/co/"),
};
const config = getCoQstConfig(configEnv);
const environmentLabel = config.environmentLabel;
const root = path.resolve("tests/markets/co/qst/base-store");
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const artifactDir = path.resolve(process.env.CO_QST_ARTIFACT_DIR || process.env.MX_QST_ARTIFACT_DIR || "test-results/jenkins/co-qst");
const reportFile = path.join(artifactDir, "results.json");
const sessionReportFile = path.join(artifactDir, "session-results.json");
const registeredReportFile = path.join(artifactDir, "registered-results.json");
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const allureResultsDir = path.join(artifactDir, "allure-results");
const executiveDir = path.join(artifactDir, "executive");

const CO_BASE_P1_IDS = Object.freeze(
  Object.entries(reusePlan.cases)
    .filter(([, value]) => value.store === "BS")
    .map(([id]) => id)
    .sort()
);
if (CO_BASE_P1_IDS.length !== 29) {
  throw new Error(`CO Base Store P1 inventory drift: expected 29 official IDs, found ${CO_BASE_P1_IDS.length}.`);
}
const officialSet = new Set(CO_BASE_P1_IDS);
const requestedTargetIds = String(process.env.CO_QST_TARGET_IDS || "")
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const unknownTargetIds = requestedTargetIds.filter((id) => !officialSet.has(id));
if (unknownTargetIds.length) throw new Error(`Unknown CO_QST_TARGET_IDS: ${unknownTargetIds.join(", ")}.`);
const executionIds = requestedTargetIds.length ? requestedTargetIds : CO_BASE_P1_IDS;
process.env.CO_QST_TARGET_IDS = requestedTargetIds.join(",");
configEnv.CO_QST_TARGET_IDS = requestedTargetIds.join(",");
configEnv.CO_QST_FULL_P1_COUNT = String(CO_BASE_P1_IDS.length);

function grepPattern(ids) {
  return `(?:${ids.join("|")})\\b`;
}

function specFilesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return specFilesUnder(target);
    return entry.isFile() && entry.name.endsWith(".spec.js") ? [target] : [];
  });
}
const specFiles = specFilesUnder(root);
const allTitles = specFiles.flatMap((file) => testTitles(fs.readFileSync(file, "utf8")));
const officialTitles = allTitles.filter((title) => officialSet.has(title.match(/SAM-\d+/)?.[0]));
const implementedTitles = officialTitles.filter((title) => !/@not-run\b/i.test(title));
const representedIds = new Set(officialTitles.map((title) => title.match(/SAM-\d+/)?.[0]));
const implementedIds = new Set(implementedTitles.map((title) => title.match(/SAM-\d+/)?.[0]));
const missingIds = CO_BASE_P1_IDS.filter((id) => !representedIds.has(id));
const explicitNotRunIds = officialTitles
  .filter((title) => /@not-run\b/i.test(title))
  .map((title) => title.match(/SAM-\d+/)?.[0])
  .filter(Boolean);
const duplicateIds = CO_BASE_P1_IDS.filter((id) => implementedTitles.filter((title) => title.includes(id)).length > 1);

const registeredIds = implementedTitles
  .filter((title) => /@registered\b/i.test(title))
  .map((title) => title.match(/SAM-\d+/)?.[0])
  .filter((id) => id && executionIds.includes(id));
const sessionGateIds = ["SAM-24873", "SAM-24874"].filter((id) => registeredIds.includes(id));
const remainingRegisteredIds = registeredIds.filter((id) => !sessionGateIds.includes(id));
const guestAndSafeIds = executionIds.filter((id) => !registeredIds.includes(id));

console.log(`[co-qst] Official CO ${targetEnvironment} Base Store P1 scope: ${CO_BASE_P1_IDS.length} TCs.`);
if (requestedTargetIds.length) console.log(`[co-qst] Targeted execution: ${executionIds.join(", ")}.`);
if (registeredIds.length) console.log(`[co-qst] Registered-first order: ${registeredIds.join(", ")}.`);
console.log(`[co-qst] Represented in canonical Base Store scope: ${representedIds.size}/${CO_BASE_P1_IDS.length}.`);
console.log(`[co-qst] Executable implementations: ${implementedIds.size}/${CO_BASE_P1_IDS.length}.`);
console.log(`[co-qst] Explicit NOT_RUN: ${explicitNotRunIds.join(", ") || "none"}.`);
if (missingIds.length) {
  console.error(`[co-qst] Missing canonical implementations: ${missingIds.join(", ")}`);
  process.exit(1);
}
if (duplicateIds.length) {
  console.error(`[co-qst] Duplicate official CO IDs detected: ${duplicateIds.join(", ")}`);
  process.exit(1);
}

function buildArgs(ids, outputDir, list = false) {
  const args = [
    playwrightCli, "test", "tests/markets/co/qst/base-store",
    "--project=chromium", "--workers=1", "--retries=0",
    "--grep", grepPattern(ids),
    "--output", outputDir,
  ];
  if (list) args.push("--list", "--reporter=list");
  else if (process.env.MX_QST_HEADLESS !== "1") args.splice(4, 0, "--headed");
  return args;
}

if (listOnly) {
  const listed = spawnSync(process.execPath, buildArgs(executionIds, path.join(artifactDir, "playwright"), true), {
    env: configEnv,
    stdio: "inherit",
  });
  process.exit(listed.status ?? 1);
}

for (const target of [
  reportFile,
  sessionReportFile,
  registeredReportFile,
  runtimeSummaryFile,
  path.join(artifactDir, "playwright"),
  path.join(artifactDir, "playwright-session"),
  path.join(artifactDir, "playwright-registered"),
  path.join(artifactDir, "playwright-report"),
  path.join(artifactDir, "playwright-report-session"),
  path.join(artifactDir, "playwright-report-registered"),
  path.join(artifactDir, "evidence"),
  allureResultsDir,
  path.join(artifactDir, "allure-report"),
  executiveDir,
]) fs.rmSync(target, { recursive: true, force: true });

const executionEnv = {
  ...configEnv,
  TEST_ENV: environmentLabel,
  TEST_MARKET: "CO",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "P1/QST",
  CO_QST_ENVIRONMENT: targetEnvironment,
  CO_QST_TARGET_IDS: requestedTargetIds.join(","),
  CO_QST_FULL_P1_COUNT: String(CO_BASE_P1_IDS.length),
  CO_STOREFRONT_URL: config.baseUrl.href,
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(artifactDir, "playwright-report"),
  SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  ALLURE_RESULTS_DIR: allureResultsDir,
  ALLOW_PAYMENT_SUBMIT: process.env.ALLOW_PAYMENT_SUBMIT ?? "1",
  ALLOW_PROFILE_WRITE: process.env.ALLOW_PROFILE_WRITE ?? "1",
  BACKOFFICE_ENV: targetEnvironment.toLowerCase(),
};

const titles = Object.fromEntries(implementedTitles.map((title) => [title.match(/SAM-\d+/)?.[0], title]));
const phaseReports = [];
let result = { status: 0 };
let registeredPhaseFailed = false;

function readPhaseReport(reportPath) {
  if (!fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  phaseReports.push(report);
  return report;
}

function runPhase({ label, ids, reportPath, outputDir, htmlDir, evidenceDir, allure = false }) {
  if (!ids.length) return { status: 0, report: null };
  console.log(`\n[co-qst] ${label}: ${ids.join(", ")}`);
  const phaseEnv = {
    ...executionEnv,
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
    PLAYWRIGHT_HTML_OUTPUT_DIR: htmlDir,
    SMB_EVIDENCE_DIR: evidenceDir,
    ENABLE_ALLURE: allure ? executionEnv.ENABLE_ALLURE : "0",
  };
  const phaseResult = spawnSync(process.execPath, buildArgs(ids, outputDir), {
    env: phaseEnv,
    stdio: "inherit",
  });
  return { status: phaseResult.status ?? 1, report: readPhaseReport(reportPath) };
}

if (sessionGateIds.length) {
  const session = runPhase({
    label: "Running authenticated session gate first",
    ids: sessionGateIds,
    reportPath: sessionReportFile,
    outputDir: path.join(artifactDir, "playwright-session"),
    htmlDir: path.join(artifactDir, "playwright-report-session"),
    evidenceDir: path.join(artifactDir, "evidence", "session"),
  });

  if (session.report) {
    const sessionSummary = buildMxQstRuntimeSummary(session.report, {
      officialIds: sessionGateIds,
      titles,
      market: "CO",
      store: "BASE_STORE",
      environment: environmentLabel,
      suite: "P1/QST SESSION GATE",
    });
    const sessionHealthy = sessionSummary.summary.passed === sessionGateIds.length
      && sessionSummary.summary.failed === 0
      && sessionSummary.summary.blocked === 0
      && sessionSummary.summary.notRun === 0;
    console.log(`[co-qst] Session gate: Passed=${sessionSummary.summary.passed}/${sessionGateIds.length} Failed=${sessionSummary.summary.failed} Blocked=${sessionSummary.summary.blocked} NotRun=${sessionSummary.summary.notRun}`);
    if (!sessionHealthy) result.status = session.status || 1;
  } else {
    result.status = session.status || 1;
  }

  if (result.status !== 0) {
    console.error("[co-qst] Session gate failed. Remaining registered and guest/safe Base Store TCs will not run.");
  }
}

if (result.status === 0 && remainingRegisteredIds.length) {
  const registered = runPhase({
    label: "Session gate passed. Running remaining registered TCs",
    ids: remainingRegisteredIds,
    reportPath: registeredReportFile,
    outputDir: path.join(artifactDir, "playwright-registered"),
    htmlDir: path.join(artifactDir, "playwright-report-registered"),
    evidenceDir: path.join(artifactDir, "evidence", "registered"),
  });
  if (registered.status !== 0) registeredPhaseFailed = true;
}

if (result.status === 0 && guestAndSafeIds.length) {
  console.log(`\n[co-qst] Registered block finished. Running remaining ${guestAndSafeIds.length} guest/safe Base Store TCs.`);
  const mainResult = spawnSync(process.execPath, buildArgs(guestAndSafeIds, path.join(artifactDir, "playwright")), {
    env: executionEnv,
    stdio: "inherit",
  });
  result.status = mainResult.status ?? 1;
  readPhaseReport(reportFile);
}

if (phaseReports.length) {
  const baseReport = phaseReports[phaseReports.length - 1];
  const mergedReport = {
    ...baseReport,
    suites: phaseReports.flatMap((report) => report.suites || []),
    errors: phaseReports.flatMap((report) => report.errors || []),
  };
  fs.writeFileSync(reportFile, JSON.stringify(mergedReport, null, 2));
}

if (registeredPhaseFailed && result.status === 0) result.status = 1;

if (fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const runtimeSummary = buildMxQstRuntimeSummary(report, {
    officialIds: CO_BASE_P1_IDS,
    titles,
    market: "CO",
    store: "BASE_STORE",
    environment: environmentLabel,
    suite: "P1/QST",
  });
  writeRuntimeSummary(runtimeSummaryFile, runtimeSummary);

  const executive = spawnSync(process.execPath, [
    path.resolve("reporting/executive-v3/generateExecutiveV3.cjs"),
    path.resolve("governance/preqa2-validation.json"),
    path.join(executiveDir, "index.html"),
    path.join(executiveDir, "history.json"),
    runtimeSummaryFile,
  ], { stdio: "inherit", env: executionEnv });
  if (executive.status !== 0) console.error("[co-qst] Executive dashboard generation failed; raw runtime summary was preserved.");

  console.log(`\nCO ${targetEnvironment} BASE STORE P1 SUMMARY`);
  console.log(`Official=${runtimeSummary.summary.official} Executed=${runtimeSummary.summary.executed} Passed=${runtimeSummary.summary.passed} Failed=${runtimeSummary.summary.failed} Blocked=${runtimeSummary.summary.blocked} NotRun=${runtimeSummary.summary.notRun}`);

  const targeted = requestedTargetIds.length > 0;
  if (runtimeSummary.summary.failed > 0 || runtimeSummary.summary.blocked > 0) {
    process.exitCode = result.status || 1;
  } else if (!targeted && runtimeSummary.summary.notRun > 0) {
    process.exitCode = result.status || 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} else {
  process.exitCode = result.status ?? 1;
}
