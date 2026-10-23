const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { MX_BASE_P1_IDS, MX_BASE_P1_EXCLUSIONS } = require("../utils/mxQstScope.cjs");

const artifactDir = path.resolve(process.env.MX_QST_ARTIFACT_DIR || process.env.JENKINS_ARTIFACT_DIR || "test-results/jenkins/mx-qst");
const resultsDir = path.join(artifactDir, "allure-results");
const reportDir = path.join(artifactDir, "allure-report");
const runtimeFile = path.join(artifactDir, "runtime-summary.json");
const evidenceRoot = path.join(artifactDir, "evidence");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure] No MX QST Allure results found; nothing to finalize.");
  process.exit(0);
}

function polish(phase) {
  const polished = spawnSync(process.execPath, [
    path.resolve("scripts/polish-allure-final.cjs"),
    resultsDir,
    phase,
  ], { stdio: "inherit", env: process.env });
  if (polished.status !== 0) {
    console.error(`[allure] Final polish (${phase}) failed; processing will continue with preserved results.`);
  }
}

function polishGeneratedReport() {
  const script = path.resolve("scripts/polish-generated-allure-report.cjs");
  if (!fs.existsSync(script)) {
    console.error("[allure] Generated-report polish script is missing.");
    return false;
  }
  const polished = spawnSync(process.execPath, [script, resultsDir, reportDir], {
    stdio: "inherit",
    env: process.env,
  });
  if (polished.status !== 0) {
    console.error("[allure] Generated report did not satisfy the final rich-description contract.");
    return false;
  }
  return true;
}

const enrich = spawnSync(process.execPath, [
  path.resolve("scripts/enrich-allure-mx-qst.cjs"),
  resultsDir,
  runtimeFile,
  evidenceRoot,
], { stdio: "inherit", env: process.env });
if (enrich.status !== 0) process.exit(enrich.status || 1);

// Reconcile the published denominator to the active 29-TC campaign. The
// historical Rewards/PSE row remains in governance only for traceability.
const environmentFile = path.join(resultsDir, "environment.properties");
const excludedIds = Object.keys(MX_BASE_P1_EXCLUSIONS);
const existing = fs.existsSync(environmentFile)
  ? fs.readFileSync(environmentFile, "utf8").split(/\r?\n/)
  : [];
const filtered = existing
  .filter((line) => line && !/^(Official_P1_QST|MX_BaseStore_P1_Selected|MX_BaseStore_P1_Excluded|MX_BaseStore_P1_Excluded_IDs)=/.test(line));
filtered.push(
  `Official_P1_QST=${MX_BASE_P1_IDS.length}`,
  `MX_BaseStore_P1_Selected=${MX_BASE_P1_IDS.length}`,
  `MX_BaseStore_P1_Excluded=${excludedIds.length}`,
  `MX_BaseStore_P1_Excluded_IDs=${excludedIds.join(",") || "none"}`,
);
fs.writeFileSync(environmentFile, `${filtered.join("\n")}\n`);

// Preserve screenshots/trace/video from technical steps before dedupe removes technical step noise.
polish("evidence");

const dedupe = spawnSync(process.execPath, [
  path.resolve("scripts/dedupe-allure-evidence.cjs"),
  resultsDir,
], { stdio: "inherit", env: process.env });
if (dedupe.status !== 0) process.exit(dedupe.status || 1);

// Enforce the same final visual contract used by PE/CO/CL after known-defect mapping and cleanup.
polish("final");

const metadata = spawnSync(process.execPath, [
  path.resolve("scripts/prepare-allure-ci-metadata.cjs"),
  resultsDir,
  reportDir,
  "prepare",
], { stdio: "inherit", env: process.env });
if (metadata.status !== 0) {
  console.error("[allure] Jenkins/environment metadata preparation failed; report generation will continue.");
}

const knownDefects = spawnSync(process.execPath, [
  path.resolve("scripts/annotate-known-defects-dashboard.cjs"),
  artifactDir,
], { stdio: "inherit", env: process.env });
if (knownDefects.status !== 0) {
  console.error("[reporting] Known-defect dashboard annotation failed; the original dashboard was preserved.");
}

const allureCli = process.platform === "win32"
  ? path.resolve("node_modules/.bin/allure.cmd")
  : path.resolve("node_modules/.bin/allure");
if (!fs.existsSync(allureCli)) {
  console.error("[allure] Allure CLI is not installed; enriched raw results were preserved.");
  process.exit(0);
}

const generated = spawnSync(allureCli, ["generate", resultsDir, "--clean", "-o", reportDir], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
if (generated.status !== 0) {
  console.error("[allure] Final enriched report generation failed; raw results were preserved.");
  process.exit(generated.status || 1);
}

if (!polishGeneratedReport()) {
  process.exitCode = 1;
} else {
  const savedHistory = spawnSync(process.execPath, [
    path.resolve("scripts/prepare-allure-ci-metadata.cjs"),
    resultsDir,
    reportDir,
    "save",
  ], { stdio: "inherit", env: process.env });
  if (savedHistory.status !== 0) {
    console.error("[allure] Trend history persistence failed; generated report was preserved.");
  }
}

console.log(`[allure] Final Samsung MX QST report generated: ${reportDir}`);
