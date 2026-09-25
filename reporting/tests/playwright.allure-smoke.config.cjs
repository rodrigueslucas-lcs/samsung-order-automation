const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const resultsDir = process.env.ALLURE_RESULTS_DIR
  || path.join(process.cwd(), "test-results", "reporter-tests", "allure-smoke", "allure-results");

module.exports = defineConfig({
  testDir: "./fixtures",
  testMatch: "allure-smoke.spec.js",
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["allure-playwright", { resultsDir, detail: true, suiteTitle: false }],
  ],
  use: { screenshot: "off", trace: "off", video: "off" },
});
