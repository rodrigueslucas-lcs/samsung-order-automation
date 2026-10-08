const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const plan = require("../governance/cl-qst-plan.json");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { getClQstConfig } = require("../config/markets/cl");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const cfg = getClQstConfig({ ...process.env, CL_QST_ENVIRONMENT: targetEnvironment });
const allOfficialIds = Object.keys(plan.cases);
if (allOfficialIds.length !== 38) throw new Error(`CL official P1 drift: expected 38 IDs, found ${allOfficialIds.length}.`);

const requestedStore = String(process.env.CL_QST_STORE || "ALL").trim().toUpperCase();
if (!["ALL", "BS", "EPP", "BASE_STORE", "BASE-STORE"].includes(requestedStore)) {
  throw new Error("CL_QST_STORE must be ALL, BS/base-store or EPP.");
}
const normalizedStore = ["BS", "BASE_STORE", "BASE-STORE"].includes(requestedStore) ? "BS" : requestedStore;
const officialIds = normalizedStore === "ALL"
  ? allOfficialIds
  : allOfficialIds.filter((id) => plan.cases[id]?.store === normalizedStore);

const expectedScopeCount = normalizedStore === "BS" ? 31 : normalizedStore === "EPP" ? 7 : 38;
if (officialIds.length !== expectedScopeCount) {
  throw new Error(`CL ${normalizedStore} scope drift: expected ${expectedScopeCount} IDs, found ${officialIds.length}.`);
}

const requestedTargetIds = String(process.env.CL_QST_TARGET_IDS || "")
  .split(/[\s,;]+/)
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const unknown = requestedTargetIds.filter((id) => !allOfficialIds.includes(id));
if (unknown.length) throw new Error(`Unknown CL_QST_TARGET_IDS: ${unknown.join(", ")}.`);
const outsideScope = requestedTargetIds.filter((id) => !officialIds.includes(id));
if (outsideScope.length) {
  throw new Error(`CL_QST_TARGET_IDS outside ${normalizedStore} scope: ${outsideScope.join(", ")}.`);
}
const executionIds = requestedTargetIds.length ? requestedTargetIds : officialIds;
const targetPattern = `(?:${executionIds.join("|")})\\b`;

const defaultArtifactFolder = normalizedStore === "BS" ? "cl-base-store" : normalizedStore === "EPP" ? "cl-epp" : "cl-qst";
const artifactDir = path.resolve(process.env.CL_QST_ARTIFACT_DIR || `test-results/jenkins/${defaultArtifactFolder}`);
const reportFile = path.join(artifactDir, "results.json");
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const executiveDir = path.join(artifactDir, "executive");
const playwrightReportDir = path.join(artifactDir, "playwright-report");
const outputDir = path.join(artifactDir, "playwright");
const storeLabel = normalizedStore === "BS" ? "BASE_STORE" : normalizedStore === "EPP" ? "EPP" : "SMB";

const env = {
  ...process.env,
  CL_QST_ENVIRONMENT: targetEnvironment,
  CL_STOREFRONT_URL: cfg.baseUrl.href,
  BACKOFFICE_ENV: process.env.BACKOFFICE_ENV || targetEnvironment.toLowerCase(),
  SMB_TEST_CARD_FILE: process.env.SMB_TEST_CARD_FILE || path.resolve("playwright/.auth/mx-test-card.json"),
  TEST_ENV: cfg.environmentLabel,
  TEST_MARKET: "CL",
  TEST_STORE: storeLabel,
  TEST_SUITE: "P1/QST",
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
  PLAYWRIGHT_HTML_OUTPUT_DIR: playwrightReportDir,
  CL_QST_FULL_P1_COUNT: String(officialIds.length),
  SMB_EVIDENCE_DIR: path.join(artifactDir, "evidence"),
  PW_TRACE: process.env.PW_TRACE ?? (process.env.CI ? "1" : "0"),
  ALLOW_PAYMENT_SUBMIT: process.env.ALLOW_PAYMENT_SUBMIT ?? "0",
  ALLOW_PROFILE_WRITE: process.env.ALLOW_PROFILE_WRITE ?? "0",
};

const cli = path.resolve("node_modules/@playwright/test/cli.js");
const args = [
  cli,
  "test",
  "tests/markets/cl/qst/official-p1.spec.js",
  "--project=chromium",
  "--workers=1",
  "--retries=0",
  "--grep",
  targetPattern,
  "--output",
  outputDir,
];
if (listOnly) args.push("--list", "--reporter=list");
else if (process.env.CL_QST_HEADLESS !== "1" && !process.env.CI) args.push("--headed");

console.log("\n============================================================");
console.log(` SAMSUNG CL ${targetEnvironment} · OFFICIAL QST P1 · ${storeLabel}`);
console.log("============================================================");
console.log(`[cl-qst] Official scope: ${officialIds.length} TCs (${storeLabel}).`);
console.log(`[cl-qst] Execution: ${requestedTargetIds.length ? `TARGETED ${executionIds.length}` : "FULL"}.`);
if (requestedTargetIds.length) console.log(`[cl-qst] Target IDs: ${executionIds.join(", ")}`);
console.log("============================================================\n");

if (!listOnly) fs.rmSync(artifactDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
if (listOnly) process.exit(result.status ?? 1);

if (!fs.existsSync(reportFile)) process.exit(result.status ?? 1);
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const titles = Object.fromEntries(officialIds.map((id) => [id, plan.cases[id].title]));
const summary = buildMxQstRuntimeSummary(report, {
  officialIds,
  titles,
  market: "CL",
  store: storeLabel,
  environment: cfg.environmentLabel,
  suite: "P1/QST",
});
writeRuntimeSummary(runtimeSummaryFile, summary);

fs.mkdirSync(executiveDir, { recursive: true });
const executive = spawnSync(process.execPath, [
  path.resolve("reporting/executive-v3/generateExecutiveV3.cjs"),
  path.resolve("governance/preqa2-validation.json"),
  path.join(executiveDir, "index.html"),
  path.join(executiveDir, "history.json"),
  runtimeSummaryFile,
], { env, stdio: "inherit" });
if (executive.status !== 0) console.error("[cl-qst] Executive dashboard generation failed; runtime summary was preserved.");

console.log("\n============================================================");
console.log(` SAMSUNG CL ${targetEnvironment} · FINAL RESULT · ${storeLabel}`);
console.log("============================================================");
console.log(` Official : ${summary.summary.official}`);
console.log(` Executed : ${summary.summary.executed}`);
console.log(` Passed   : ${summary.summary.passed}`);
console.log(` Failed   : ${summary.summary.failed}`);
console.log(` Blocked  : ${summary.summary.blocked}`);
console.log(` NotRun   : ${summary.summary.notRun}`);
console.log("============================================================");

const targeted = requestedTargetIds.length > 0;
if (summary.summary.failed > 0) process.exitCode = result.status || 1;
else if (!targeted && summary.summary.notRun > 0) process.exitCode = result.status || 1;
else process.exitCode = 0;
