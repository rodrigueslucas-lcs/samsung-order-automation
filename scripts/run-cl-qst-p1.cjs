const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const plan = require("../governance/cl-qst-plan.json");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");
const { getClQstConfig } = require("../config/markets/cl");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const cfg = getClQstConfig({ ...process.env, CL_QST_ENVIRONMENT: targetEnvironment });
const officialIds = Object.keys(plan.cases);
if (officialIds.length !== 38) throw new Error(`CL official P1 drift: expected 38 IDs, found ${officialIds.length}.`);

const requestedTargetIds = String(process.env.CL_QST_TARGET_IDS || "")
  .split(/[\s,;]+/)
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const unknown = requestedTargetIds.filter((id) => !officialIds.includes(id));
if (unknown.length) throw new Error(`Unknown CL_QST_TARGET_IDS: ${unknown.join(", ")}.`);
const executionIds = requestedTargetIds.length ? requestedTargetIds : officialIds;
const targetPattern = `(?:${executionIds.join("|")})\\b`;

const artifactDir = path.resolve(process.env.CL_QST_ARTIFACT_DIR || "test-results/jenkins/cl-qst");
const reportFile = path.join(artifactDir, "results.json");
const runtimeSummaryFile = path.join(artifactDir, "runtime-summary.json");
const executiveDir = path.join(artifactDir, "executive");
const playwrightReportDir = path.join(artifactDir, "playwright-report");
const outputDir = path.join(artifactDir, "playwright");

const env = {
  ...process.env,
  CL_QST_ENVIRONMENT: targetEnvironment,
  CL_STOREFRONT_URL: cfg.baseUrl.href,
  TEST_ENV: cfg.environmentLabel,
  TEST_MARKET: "CL",
  TEST_STORE: "SMB",
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
console.log(` SAMSUNG CL ${targetEnvironment} · OFFICIAL QST P1`);
console.log("============================================================");
console.log(`[cl-qst] Official scope: ${officialIds.length} TCs (31 Base Store + 7 EPP).`);
console.log(`[cl-qst] Execution: ${requestedTargetIds.length ? `TARGETED ${executionIds.length}` : "FULL"}.`);
if (requestedTargetIds.length) console.log(`[cl-qst] Target IDs: ${executionIds.join(", ")}`);
console.log("============================================================\n");

if (!listOnly) fs.rmSync(artifactDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
if (listOnly) process.exit(result.status ?? 1);

if (!fs.existsSync(reportFile)) process.exit(result.status ?? 1);
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const titles = Object.fromEntries(Object.entries(plan.cases).map(([id, value]) => [id, value.title]));
const summary = buildMxQstRuntimeSummary(report, {
  officialIds,
  titles,
  market: "CL",
  store: "SMB",
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
console.log(` SAMSUNG CL ${targetEnvironment} · FINAL RESULT`);
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
