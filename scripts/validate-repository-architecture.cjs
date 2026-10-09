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
  "docs/HANDOFF_GUIDE.md",
  "docs/AUTHENTICATION_GUIDE.md",
  "docs/JENKINS_BEGINNER_GUIDE.md",
  "docs/TROUBLESHOOTING.md",
  "tests/markets/mx/qst/base-store",
  "tests/markets/mx/dst/base-store",
  "tests/markets/mx/dst/backoffice",
  "tests/markets/pe/qst/base-store",
  "tests/markets/pe/qst/epp",
  "tests/markets/pe/dst/base-store",
  "tests/markets/pe/dst/epp",
  "tests/markets/pe/dst/backoffice",
  "tests/markets/co/qst/base-store",
  "tests/markets/co/qst/epp",
  "tests/markets/cl/qst/base-store",
  "tests/markets/cl/qst/epp",
  "tests/markets/shared",
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
  "tests/s1",
  "tests/s2",
  "tests/legacy",
  "tests/README.md",
  "tests/markets/README.md",
  "tests/markets/pe/README.md",
  "tests/markets/pe/qst/README.md",
  "tests/markets/cl/qst/official-p1.spec.js",
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
      boundaryFailures.push(`${file}: active consumer must not reference removed compatibility boundary ${literal}`);
    }
  }
}

const removedTestRoots = ["tests/s1/", "tests/s2/", "tests/legacy/"];
const removedOwnershipRoots = ["reporters/", "test-mapping/"];
const forbiddenConsumers = [...removedTestRoots, ...removedOwnershipRoots];

forbidLiteral("Jenkinsfile", forbiddenConsumers);
forbidLiteral("package.json", forbiddenConsumers);
forbidLiteral("scripts/run-mx-qst-safe.cjs", forbiddenConsumers);
forbidLiteral("scripts/run-mx-qst-fast-guest.cjs", forbiddenConsumers);
forbidLiteral("scripts/run-pe-qst-p1.cjs", forbiddenConsumers);
forbidLiteral("scripts/run-co-qst-p1.cjs", forbiddenConsumers);
forbidLiteral("scripts/run-cl-qst-p1.cjs", forbiddenConsumers);

if (missing.length || resurrected.length || boundaryFailures.length) {
  console.error("[repo-architecture] FAIL");
  if (missing.length) console.error(`Missing required architecture paths: ${missing.join(", ")}`);
  if (resurrected.length) console.error(`Removed/redundant paths must not return: ${resurrected.join(", ")}`);
  for (const failure of boundaryFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[repo-architecture] PASS");
console.log("[repo-architecture] Canonical test navigation is market -> suite -> store under tests/markets.");
console.log("[repo-architecture] MX/PE/CO/CL active QST entry points are canonical market paths.");
console.log("[repo-architecture] PE DST is canonical under tests/markets/pe/dst; legacy and environment-named roots are removed.");
console.log("[repo-architecture] CL QST is physically separated into base-store and epp ownership.");
console.log("[repo-architecture] Reporting ownership is canonical under reporting/.");
console.log("[repo-architecture] Governance ownership is canonical under governance/.");
console.log("[repo-architecture] Active CI/runners cannot depend on removed compatibility boundaries.");
