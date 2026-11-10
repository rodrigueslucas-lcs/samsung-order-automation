import { defineConfig, devices } from "@playwright/test";
import eppConfig from './config/markets/epp';
const privateCiEvidence = process.env.CI === '1' && process.env.EPP_CI_PRIVATE_EVIDENCE === '1';

// EPP never inherits Base Store auth projects, grep, storageState or artifacts.
export default defineConfig({
  metadata: process.env.TEST_MARKET ? {epp:((cfg)=>({market:cfg.market,environment:cfg.environment,program:cfg.program,runId:process.env.EPP_RUN_ID||null,executionMode:process.env.EPP_RESUME_PENDING_ORDER==='1'?'RECOVERY_ONLY':'NORMAL'}))(eppConfig.getEppConfig(process.env.TEST_MARKET,process.env))} : {},
  testDir: "./tests/markets",
  testMatch: "**/qst/epp/*.spec.js",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,
  outputDir: process.env.EPP_OUTPUT_DIR || "test-results/epp/playwright",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || "test-results/epp/html" }],
    ["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || "test-results/epp/results.json" }],
    ...(process.env.ENABLE_ALLURE === "1" ? [["allure-playwright", { resultsDir: process.env.ALLURE_RESULTS_DIR || "test-results/epp/allure", detail: false }]] : []),
    ["./reporting/evidence/SmbEvidenceReporter.js", { outputDir: process.env.SMB_EVIDENCE_DIR || "test-results/epp/evidence" }],
  ],
  use: {
    ...devices["Desktop Chrome"], channel: "chrome",
    headless: process.env.BROWSER_MODE !== "headed",
    viewport: process.env.BROWSER_MODE === "headed" ? null : { width: 1440, height: 900 },
    deviceScaleFactor: process.env.BROWSER_MODE === "headed" ? undefined : devices["Desktop Chrome"].deviceScaleFactor,
    launchOptions: { args: ["--start-maximized"], devtools: false },
    // Access codes must not be captured by Playwright action logs or video.
    // Enable business tracing only after a separate untraced access fixture exists.
    trace: "off", video: "off", screenshot: "off",
    // CI stores raw traces outside the browsable workspace; only the validated
    // redacted copy is published. Local access-code capture remains disabled.
    ...(privateCiEvidence ? { trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false, sources: false } } : {}),
    actionTimeout: 15000, navigationTimeout: 60000,
  },
  projects: [{ name: "EPP · isolated Chromium" }],
});
