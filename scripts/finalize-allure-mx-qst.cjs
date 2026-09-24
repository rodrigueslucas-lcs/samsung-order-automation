const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { MX_BASE_P1_IDS, MX_BASE_P1_EXCLUSIONS } = require("../utils/mxQstScope.cjs");

const artifactDir = path.resolve(process.env.MX_QST_ARTIFACT_DIR || "test-results/jenkins/mx-qst");
const resultsDir = path.join(artifactDir, "allure-results");
const reportDir = path.join(artifactDir, "allure-report");
const runtimeFile = path.join(artifactDir, "runtime-summary.json");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure] No MX QST Allure results found; nothing to finalize.");
  process.exit(0);
}

const enrich = spawnSync(process.execPath, [
  path.resolve("scripts/enrich-allure-mx-qst.cjs"),
  resultsDir,
  runtimeFile,
], { stdio: "inherit", env: process.env });
if (enrich.status !== 0) process.exit(enrich.status || 1);

// The historical/source metadata still contains the original 30 mapped MX Base
// P1 rows. Reconcile the published Allure environment to the active campaign so
// the report denominator always matches the runner and Executive Dashboard.
const environmentFile = path.join(resultsDir, "environment.properties");
if (fs.existsSync(environmentFile)) {
  const excludedIds = Object.keys(MX_BASE_P1_EXCLUSIONS);
  const filtered = fs.readFileSync(environmentFile, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !/^(Official_P1_QST|MX_BaseStore_P1_Selected|Source_P1_QST|Active_P1_QST|MX_BaseStore_P1_Excluded|MX_BaseStore_P1_Excluded_IDs)=/.test(line));
  filtered.push(
    "Source_P1_QST=144",
    "Active_P1_QST=143",
    `MX_BaseStore_P1_Selected=${MX_BASE_P1_IDS.length}`,
    `MX_BaseStore_P1_Excluded=${excludedIds.length}`,
    `MX_BaseStore_P1_Excluded_IDs=${excludedIds.join(",") || "none"}`,
  );
  fs.writeFileSync(environmentFile, `${filtered.join("\n")}\n`);
}

const dedupe = spawnSync(process.execPath, [
  path.resolve("scripts/dedupe-allure-evidence.cjs"),
  resultsDir,
], { stdio: "inherit", env: process.env });
if (dedupe.status !== 0) process.exit(dedupe.status || 1);

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
console.log(`[allure] Final Samsung MX QST report generated: ${reportDir}`);
