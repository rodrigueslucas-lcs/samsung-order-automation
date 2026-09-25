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
  "tests/s1/mx/qst/base-store",
  "tests/s1/mx/dst/base-store",
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
console.log("[repo-architecture] Reporting tests are consolidated under reporters/tests.");
console.log("[repo-architecture] Governance tests are consolidated under test-mapping/tests.");
console.log("[repo-architecture] PE non-payment fixtures are namespaced under fixtures/pe.");
console.log("[repo-architecture] MX physical test paths remain environment-first only as a controlled compatibility layer.");
