const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const required = [
  "README.md",
  "docs/README.md",
  "docs/REPOSITORY_AUDIT.md",
  "docs/CURRENT_ARCHITECTURE.md",
  "tests/README.md",
  "tests/markets/mx/qst/base-store",
  "tests/markets/mx/dst/base-store",
  "tests/markets/pe",
  "tests/markets/shared",
  "tests/legacy/pe-s2",
  "reporters/README.md",
  "reporters/tests",
  "test-mapping/README.md",
  "test-mapping/tests",
  "fixtures/README.md",
  "pages/README.md",
  "flows/README.md",
  "scripts/README.md",
  "utils/README.md",
  "config/README.md",
];

const forbidden = [
  "mapping-tests",
  "reporter-tests",
  "docs/test-plan.md",
  "pages/CookiePage.js",
  "fixtures/address.json",
  "fixtures/billingAddress.json",
  "fixtures/customer.json",
];

const missing = required.filter((entry) => !exists(entry));
const resurrected = forbidden.filter((entry) => exists(entry));

if (missing.length || resurrected.length) {
  console.error("[repo-architecture] FAIL");
  if (missing.length) {
    console.error(`Missing required architecture paths: ${missing.join(", ")}`);
  }
  if (resurrected.length) {
    console.error(`Legacy paths must not return: ${resurrected.join(", ")}`);
  }
  process.exit(1);
}

console.log("[repo-architecture] PASS");
console.log("[repo-architecture] Canonical navigation is market-first under tests/markets.");
console.log("[repo-architecture] Historical PE S2 generation is explicitly isolated under tests/legacy/pe-s2.");
console.log("[repo-architecture] Reporting tests are consolidated under reporters/tests.");
console.log("[repo-architecture] Governance tests are consolidated under test-mapping/tests.");
console.log("[repo-architecture] Compatibility tests/s1 and tests/s2 trees may remain temporarily for runtime-safe migration, but are hidden from the default VS Code explorer.");
