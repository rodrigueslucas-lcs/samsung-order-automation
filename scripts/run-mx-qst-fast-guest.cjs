const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { testTitles } = require("../utils/qstS1Implementation");
const { buildMxQstRuntimeSummary, writeRuntimeSummary } = require("../utils/mxQstRuntimeSummary.cjs");

const listOnly = process.argv.includes("--list");
const targetEnvironment = String(process.env.MX_QST_ENVIRONMENT || "S1").toUpperCase();
if (!["S1", "S2"].includes(targetEnvironment)) throw new Error(`Unsupported MX QST environment: ${targetEnvironment}.`);
const environmentLabel = targetEnvironment === "S2" ? "S2/STG2" : "S1/STG";
const headless = process.env.MX_QST_HEADLESS === "1";
const root = path.resolve("tests/markets/mx/qst/base-store");
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");
const fastArtifactDir = path.resolve(process.env.MX_FAST_ARTIFACT_DIR || "test-results/jenkins/mx-fast");
const reportFile = path.join(fastArtifactDir, "mx-fast-results.json");
const runtimeSummaryFile = path.join(fastArtifactDir, "runtime-summary.json");
const allureResultsDir = path.join(fastArtifactDir, "allure-results");
const allureReportDir = path.join(fastArtifactDir, "allure-report");
const executiveDir = path.join(fastArtifactDir, "executive");

const MX_FAST_GUEST_IDS = Object.freeze([
  "SAM-24971", "SAM-24972", "SAM-24975", "SAM-24981", "SAM-24982",
  "SAM-24988", "SAM-24989", "SAM-24990", "SAM-24995", "SAM-24999",
  "SAM-25001", "SAM-25004", "SAM-25005", "SAM-25016",
]);

const idSet = new Set(MX_FAST_GUEST_IDS);
const pattern = `(?:${MX_FAST_GUEST_IDS.join("|")})\\b`;
const allTitles = fs.readdirSync(root)
  .filter((name) => name.endsWith(".spec.js"))
  .flatMap((name) => testTitles(fs.readFileSync(path.join(root, name), "utf8")));
const selected = allTitles.filter((title) => idSet.has(title.match(/SAM-\d+/)?.[0]));
const counts = new Map(MX_FAST_GUEST_IDS.map((id) => [id, 0]));
for (const title of selected) {
  const id = title.match(/SAM-\d+/)?.[0];
  counts.set(id, (counts.get(id) || 0) + 1);
}
const invalid = [...counts].filter(([, count]) => count !== 1);
if (selected.length !== MX_FAST_GUEST_IDS.length || invalid.length) {
  console.error("[mx-fast] Fast guest inventory drifted; execution was not started.");
  for (const [id, count] of invalid) console.error(`  ${id}: ${count} test title(s)`);
  process.exit(1);
}
const unsafe = selected.filter((title) => /@registered|@destructive/i.test(title));
if (unsafe.length) {
  console.error("[mx-fast] Registered/destructive test entered the fast guest suite; execution was blocked.");
  for (const title of unsafe) console.error(`  - ${title}`);
  process.exit(1);
}

console.log(`[mx-fast] MX ${targetEnvironment} Base Store fast guest selection: ${selected.length} tests.`);
console.log(`[mx-fast] IDs: ${MX_FAST_GUEST_IDS.join(", ")}`);

const args = [
  playwrightCli, "test", "tests/markets/mx/qst/base-store",
  "--project=chromium", "--workers=1", "--retries=0",
  "--grep", pattern,
  "--grep-invert", "@registered|@destructive",
  "--output", path.resolve(process.env.MX_FAST_ARTIFACT_DIR || "test-results/jenkins/mx-fast", "playwright"),
];
if (listOnly) args.push("--list", "--reporter=list");
else if (!headless) args.splice(4, 0, "--headed");

if (!listOnly) {
  for (const target of [reportFile, runtimeSummaryFile, allureResultsDir, allureReportDir, executiveDir, path.join(fastArtifactDir, "playwright-report"), path.join(fastArtifactDir, "playwright"), path.join(fastArtifactDir, "evidence")]) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

const env = {
  ...process.env,
  TEST_ENV: environmentLabel,
  MX_QST_ENVIRONMENT: targetEnvironment,
  BACKOFFICE_ENV: targetEnvironment.toLowerCase(),
  TEST_MARKET: "MX",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "FAST/GUEST",
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(fastArtifactDir, "playwright-report"),
  SMB_EVIDENCE_DIR: path.join(fastArtifactDir, "evidence"),
  ALLURE_RESULTS_DIR: allureResultsDir,
  PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
};

const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });

if (!listOnly && fs.existsSync(reportFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const titles = Object.fromEntries(selected.map((title) => [title.match(/SAM-\d+/)?.[0], title]));
  const runtimeSummary = buildMxQstRuntimeSummary(report, { officialIds: MX_FAST_GUEST_IDS, titles, environment: environmentLabel, suite: "FAST/GUEST" });
  writeRuntimeSummary(runtimeSummaryFile, runtimeSummary);

  const executive = spawnSync(process.execPath, [
    path.resolve("reporting/executive-v3/generateExecutiveV3.cjs"),
    path.resolve("governance/preqa2-validation.json"),
    path.join(executiveDir, "index.html"),
    path.join(executiveDir, "history.json"),
    runtimeSummaryFile,
  ], { stdio: "inherit", env });

  if (executive.status !== 0) console.error("[mx-fast] Executive dashboard generation failed.");
}

process.exit(result.status ?? 1);
