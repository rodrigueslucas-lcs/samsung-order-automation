const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./fixtures",
  retries: 1,
  workers: 1,
  reporter: [
    ["line"],
    ["../evidence/SmbEvidenceReporter.js", {
      outputDir: "test-results/reporter-tests/evidence",
    }],
  ],
  use: { screenshot: "off", trace: "off", video: "off" },
});
