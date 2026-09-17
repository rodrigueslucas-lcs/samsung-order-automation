const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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
