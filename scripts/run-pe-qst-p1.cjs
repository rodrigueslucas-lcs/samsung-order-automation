const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const reusePlan = require("../governance/pe-qst-reuse-plan.json");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { getPeQstConfig } = require("../config/markets/pe");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
if (!["S1", "S2"].includes(targetEnvironment)) throw new Error(`Unsupported PE QST environment: ${targetEnvironment}.`);

const configEnv = {
  ...process.env,
  PE_QST_ENVIRONMENT: targetEnvironment,
  PE_STOREFRONT_URL: process.env.PE_STOREFRONT_URL || (targetEnvironment === "S2"
    ? "https://stg2.shop.samsung.com/pe/"
    : "https://stg.shop.samsung.com/pe/"),
};
const config = getPeQstConfig(configEnv);
const environmentLabel = config.environmentLabel;
const root = path.resolve("tests/markets/pe/qst/base-store");
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const artifactDir = path.resolve(process.env.PE_QST_ARTIFACT_DIR || process.env.MX_QST_ARTIFACT_DIR || "test-results/jenkins/pe-qst");
const reportFile = path.join(artifactDir, "results.json");
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const allureResultsDir = path.join(artifactDir, "allure-results");
const executiveDir = path.join(artifactDir, "executive");

const PE_BASE_P1_IDS = Object.freeze(
  Object.entries(reusePlan.cases)
    .filter(([, value]) => value.store === "BS")
    .map(([id]) => id)
    .sort()
);
if (PE_BASE_P1_IDS.length !== 28) {
  throw new Error(`PE Base Store P1 inventory drift: expected 28 official IDs, found ${PE_BASE_P1_IDS.length}.`);
}
const officialSet = new Set(PE_BASE_P1_IDS);
const p1Pattern = `(?:${PE_BASE_P1_IDS.join("|")})\\b`;

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
const missingIds = PE_BASE_P1_IDS.filter((id) => !representedIds.has(id));
const explicitNotRunIds = officialTitles
  .filter((title) => /@not-run\b/i.test(title))
  .map((title) => title.match(/SAM-\d+/)?.[0])
  .filter(Boolean);
const duplicateIds = PE_BASE_P1_IDS.filter((id) => implementedTitles.filter((title) => title.includes(id)).length > 1);

console.log(`[pe-qst] Official PE ${targetEnvironment} Base Store P1 scope: ${PE_BASE_P1_IDS.length} TCs.`);
console.log(`[pe-qst] Represented in canonical Base Store scope: ${representedIds.size}/${PE_BASE_P1_IDS.length}.`);
console.log(`[pe-qst] Executable implementations: ${implementedIds.size}/${PE_BASE_P1_IDS.length}.`);
console.log(`[pe-qst] Explicit NOT_RUN: ${explicitNotRunIds.join(", ") || "none"}.`);
if (missingIds.length) {
  console.error(`[pe-qst] Missing canonical implementations: ${missingIds.join(", ")}`);
  process.exit(1);
}
if (duplicateIds.length) {
  console.error(`[pe-qst] Duplicate official PE IDs detected: ${duplicateIds.join(", ")}`);
  process.exit(1);
}

const args = [
  playwrightCli, "test", "tests/markets/pe/qst/base-store",
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
  TEST_MARKET: "PE",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "P1/QST",
  PE_QST_ENVIRONMENT: targetEnvironment,
  PE_STOREFRONT_URL: config.baseUrl.href,
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(artifactDir, "playwright-report"),
  SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  ALLURE_RESULTS_DIR: allureResultsDir,
  ALLOW_PAYMENT_SUBMIT: process.env.EXECUTION_MODE === "authorized-destructive" ? "1" : "0",
};

const result = spawnSync(process.execPath, args, { env: executionEnv, stdio: "inherit" });

if (fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const titles = Object.fromEntries(implementedTitles.map((title) => [title.match(/SAM-\d+/)?.[0], title]));
  const runtimeSummary = buildMxQstRuntimeSummary(report, {
    officialIds: PE_BASE_P1_IDS,
    titles,
    market: "PE",
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
  if (executive.status !== 0) console.error("[pe-qst] Executive dashboard generation failed; raw runtime summary was preserved.");

  console.log(`\nPE ${targetEnvironment} BASE STORE P1 SUMMARY`);
  console.log(`Official=${runtimeSummary.summary.official} Executed=${runtimeSummary.summary.executed} Passed=${runtimeSummary.summary.passed} Failed=${runtimeSummary.summary.failed} Blocked=${runtimeSummary.summary.blocked} NotRun=${runtimeSummary.summary.notRun}`);

  if (runtimeSummary.summary.notRun > 0 || runtimeSummary.summary.blocked > 0 || runtimeSummary.summary.failed > 0) {
    process.exitCode = result.status || 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} else {
  process.exitCode = result.status ?? 1;
}
