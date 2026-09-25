const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const required = [
  "README.md",
  "docs/README.md",
  "docs/REPOSITORY_AUDIT.md",
  "docs/CURRENT_ARCHITECTURE.md",
  "tests/README.md",
  "tests/markets/README.md",
  "tests/legacy/README.md",
  "tests/markets/mx/qst/base-store",
  "tests/markets/mx/dst/base-store",
  "tests/markets/pe/qst/base-store",
  "tests/markets/shared",
  "tests/legacy/pe-s2",
  "reporting/README.md",
  "reporting/tests",
  "governance/README.md",
  "governance/tests",
  "fixtures/README.md",
  "pages/README.md",
  "flows/README.md",
  "scripts/README.md",
  "utils/README.md",
  "config/README.md",
  ".vscode/settings.json",
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

const compatibilityRoots = [
  "tests/s1",
  "tests/s2",
  "reporters",
  "test-mapping",
];

const missing = required.filter((entry) => !exists(entry));
const resurrected = forbidden.filter((entry) => exists(entry));
const boundaryFailures = [];

function forbidLiteral(file, literals) {
  if (!exists(file)) {
    boundaryFailures.push(`${file}: required active consumer is missing`);
    return;
  }
  const source = read(file);
  for (const literal of literals) {
    if (source.includes(literal)) {
      boundaryFailures.push(`${file}: active consumer must not reference compatibility boundary ${literal}`);
    }
  }
}

function validateVsCodeCompatibilityHiding() {
  if (!exists(".vscode/settings.json")) return;
  let settings;
  try {
    settings = JSON.parse(read(".vscode/settings.json"));
  } catch (error) {
    boundaryFailures.push(`.vscode/settings.json: invalid JSON (${error.message})`);
    return;
  }

  for (const rootName of compatibilityRoots) {
    if (settings["files.exclude"]?.[rootName] !== true) {
      boundaryFailures.push(`.vscode/settings.json: files.exclude must hide temporary compatibility root ${rootName}`);
    }
    if (settings["search.exclude"]?.[rootName] !== true) {
      boundaryFailures.push(`.vscode/settings.json: search.exclude must hide temporary compatibility root ${rootName}`);
    }
  }
}

// These are production entry points, not compatibility mirrors. Once cut over,
// they must stay on the canonical market/reporting/governance boundaries.
forbidLiteral("Jenkinsfile", ["tests/s1/", "tests/s2/", "reporters/", "test-mapping/"]);
forbidLiteral("scripts/run-mx-qst-safe.cjs", ["tests/s1/", "tests/s2/", "reporters/", "test-mapping/"]);
forbidLiteral("scripts/run-mx-qst-fast-guest.cjs", ["tests/s1/", "tests/s2/", "reporters/", "test-mapping/"]);
forbidLiteral("scripts/run-pe-qst-p1.cjs", ["tests/s1/", "tests/s2/", "reporters/", "test-mapping/"]);

// package.json may intentionally expose commands named "legacy", but executable
// paths must point at tests/legacy or canonical boundaries rather than s1/s2.
forbidLiteral("package.json", ["tests/s1/", "tests/s2/", "reporters/", "test-mapping/"]);
validateVsCodeCompatibilityHiding();

if (missing.length || resurrected.length || boundaryFailures.length) {
  console.error("[repo-architecture] FAIL");
  if (missing.length) console.error(`Missing required architecture paths: ${missing.join(", ")}`);
  if (resurrected.length) console.error(`Legacy paths must not return: ${resurrected.join(", ")}`);
  for (const failure of boundaryFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[repo-architecture] PASS");
console.log("[repo-architecture] Canonical test navigation is market-first under tests/markets.");
console.log("[repo-architecture] Historical PE S2 generation is explicit under tests/legacy/pe-s2.");
console.log("[repo-architecture] Reporting ownership is canonical under reporting/.");
console.log("[repo-architecture] Governance ownership is canonical under governance/.");
console.log("[repo-architecture] Active CI/runners no longer depend on s1/s2, reporters or test-mapping compatibility boundaries.");
console.log("[repo-architecture] VS Code hides temporary compatibility roots from normal engineer navigation/search.");
console.log("[repo-architecture] Hidden compatibility trees remain temporarily only for runtime acceptance and safe deletion.");
