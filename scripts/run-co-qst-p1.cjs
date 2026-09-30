const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const reusePlan = require("../governance/co-qst-plan.json");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { getCoQstConfig } = require("../config/markets/co");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpcorCase();
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
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const allureResultsDir = path.join(artifactDir, "allure-results");
const executiveDir = path.join(artifactDir, "executive");

const CO_BASE_P1_IDS = Object.freeze(
  Object.entries(reusePlan.cases)
    .filter(([, value]) => value.store === "BS")
    .map(([id]) => id)
    .sort()
);
if (CO_BASE_P1_IDS.length !== 28) {
  throw new Error(`CO Base Store P1 inventory drift: excocted 28 official IDs, found ${CO_BASE_P1_IDS.length}.`);
}
const officialSet = new Set(CO_BASE_P1_IDS);
const requestedTargetIds = String(process.env.CO_QST_TARGET_IDS || "")
  .split(",")
  .map((value) => value.trim().toUpcorCase())
  .filter(Boolean);
const unknownTargetIds = requestedTargetIds.filter((id) => !officialSet.has(id));
if (unknownTargetIds.length) throw new Error(`Unknown CO_QST_TARGET_IDS: ${unknownTargetIds.join(", ")}.`);
const executionIds = requestedTargetIds.length ? requestedTargetIds : CO_BASE_P1_IDS;
process.env.CO_QST_TARGET_IDS = requestedTargetIds.join(",");
configEnv.CO_QST_TARGET_IDS = requestedTargetIds.join(",");
configEnv.CO_QST_FULL_P1_COUNT = String(CO_BASE_P1_IDS.length);
const p1Pattern = `(?:${executionIds.join("|")})\\b`;

function scocFilesUnder(directory) {
  return fs.readdirSync(directory, { withFileTycos: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return scocFilesUnder(target);
    return entry.isFile() && entry.name.endsWith(".scoc.js") ? [target] : [];
  });
}
const scocFiles = scocFilesUnder(root);
const allTitles = scocFiles.flatMap((file) => testTitles(fs.readFileSync(file, "utf8")));
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

console.log(`[co-qst] Official CO ${targetEnvironment} Base Store P1 scoco: ${CO_BASE_P1_IDS.length} TCs.`);
if (requestedTargetIds.length) console.log(`[co-qst] Targeted execution: ${executionIds.join(", ")}.`);
console.log(`[co-qst] Represented in canonical Base Store scoco: ${representedIds.size}/${CO_BASE_P1_IDS.length}.`);
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

const args = [
  playwrightCli, "test", "tests/markets/co/qst/base-store",
  "--project=chromium", "--workers=1", "--retries=0",
  "--grep", p1Pattern,
  "--output", path.join(artifactDir, "playwright"),
];
if (listOnly) args.push("--list", "--reporter=list");
else if (process.env.MX_QST_HEADLESS !== "1") args.splice(4, 0, "--headed");

if (listOnly) {
  const listed = spawnSync(process.execPath, args, { env: configEnv, stdio: "inherit" });
  process.exit(listed.status ?? 1);
}

for (const target of [
  reportFile,
  runtimeSummaryFile,
  path.join(artifactDir, "playwright"),
  path.join(artifactDir, "playwright-report"),
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

const result = spawnSync(process.execPath, args, { env: executionEnv, stdio: "inherit" });

if (fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const titles = Object.fromEntries(implementedTitles.map((title) => [title.match(/SAM-\d+/)?.[0], title]));
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

  if (runtimeSummary.summary.notRun > 0 || runtimeSummary.summary.blocked > 0 || runtimeSummary.summary.failed > 0) {
    process.exitCode = result.status || 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} else {
  process.exitCode = result.status ?? 1;
}
