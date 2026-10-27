import { defineConfig, devices } from "@playwright/test";

// EPP never inherits Base Store auth projects, grep, storageState or artifacts.
export default defineConfig({
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
    launchOptions: { args: ["--start-maximized"], devtools: false },
    // Access codes must not be captured by Playwright action logs or video.
    // Enable business tracing only after a separate untraced access fixture exists.
    trace: "off", video: "off", screenshot: "off",
    actionTimeout: 15000, navigationTimeout: 60000,
  },
  projects: [{ name: "EPP · isolated Chromium" }],
});
