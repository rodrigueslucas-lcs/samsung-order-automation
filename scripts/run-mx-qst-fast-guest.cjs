const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { testTitles } = require("../utils/qstS1Implementation");

const listOnly = process.argv.includes("--list");
const headless = process.env.MX_QST_HEADLESS === "1";
const root = path.resolve("tests/s1/mx/qst/base-store");
const playwrightCli = path.resolve("node_modules/@playwright/test/cli.js");

// Fast, non-destructive MX Base Store campaign.
// These are the official P1 cases that do not require the registered storefront
// session and have already produced PASS results in the official campaign.
// Keep this suite separate from the official 30-case denominator.
const MX_FAST_GUEST_IDS = Object.freeze([
  "SAM-24971", "SAM-24972", "SAM-24975", "SAM-24981", "SAM-24982",
  "SAM-24988", "SAM-24989", "SAM-24990", "SAM-24995", "SAM-24999",
  "SAM-25001", "SAM-25002", "SAM-25004", "SAM-25005", "SAM-25016",
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

console.log(`[mx-fast] MX Base Store fast guest selection: ${selected.length} tests.`);
console.log(`[mx-fast] IDs: ${MX_FAST_GUEST_IDS.join(", ")}`);

const args = [
  playwrightCli, "test", "tests/s1/mx/qst/base-store",
  "--project=chromium", "--workers=1", "--retries=0",
  "--grep", pattern,
  "--grep-invert", "@registered|@destructive",
  "--output", path.resolve(process.env.MX_FAST_ARTIFACT_DIR || "test-results/mx-fast/playwright"),
];
if (listOnly) {
  args.push("--list", "--reporter=list");
} else if (!headless) {
  args.splice(4, 0, "--headed");
}

const env = {
  ...process.env,
  TEST_ENV: "S1/STG",
  TEST_MARKET: "MX",
  TEST_STORE: "BASE_STORE",
  TEST_SUITE: "FAST/GUEST",
  ENABLE_ALLURE: process.env.ENABLE_ALLURE || "0",
  ALLURE_RESULTS_DIR: path.resolve(process.env.MX_FAST_ARTIFACT_DIR || "test-results/mx-fast", "allure-results"),
};

const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
process.exit(result.status ?? 1);
