const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./fixtures",
  retries: 1,
  workers: 1,
  reporter: [
    ["line"],
    ["../reporters/evidence/SmbEvidenceReporter.js", {
      outputDir: "test-results/evidence",
    }],
  ],
  use: { screenshot: "off", trace: "off", video: "off" },
});
