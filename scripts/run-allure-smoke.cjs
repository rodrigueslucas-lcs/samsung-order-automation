const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const baseDir = path.join(root, "test-results", "reporter-tests", "allure-smoke");
const resultsDir = path.join(baseDir, "allure-results");
const reportDir = path.join(baseDir, "allure-report");
const playwrightCli = require.resolve("@playwright/test/cli");
const allureCli = path.join(root, "node_modules", "allure-commandline", "dist", "bin", "allure");

fs.rmSync(baseDir, { recursive: true, force: true });
fs.mkdirSync(baseDir, { recursive: true });

console.log("[allure-smoke] Isolated fixture only; no Samsung URL, auth, order or payment.");
execFileSync(process.execPath, [playwrightCli, "test", "--config=reporter-tests/playwright.allure-smoke.config.cjs"], {
  cwd: root,
  env: { ...process.env, ALLURE_RESULTS_DIR: resultsDir },
  stdio: "inherit",
});

const resultFiles = fs.readdirSync(resultsDir).filter((name) => name.endsWith("-result.json"));
if (resultFiles.length < 1) throw new Error("No Allure result JSON generated.");

execFileSync(allureCli, ["generate", resultsDir, "--clean", "-o", reportDir], {
  cwd: root,
  stdio: "inherit",
});

const indexPath = path.join(reportDir, "index.html");
if (!fs.existsSync(indexPath)) throw new Error("Allure index.html was not generated.");

console.log(`[allure-smoke] PASS: ${resultFiles.length} result file(s).`);
console.log(`[allure-smoke] PASS: ${path.relative(root, indexPath)}`);
console.log("[allure-smoke] No Samsung QST test was executed.");
