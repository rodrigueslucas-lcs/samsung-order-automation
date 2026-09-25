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
  "tests/markets/README.md",
  "tests/legacy/README.md",
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
  "tests/markets/mx/qst/base-store",
  "tests/markets/mx/dst/base-store",
  "tests/markets/pe/qst",
  "tests/markets/pe/dst",
  "tests/legacy/pe/qst",
  "tests/shared/smb/qst",
];

const forbidden = [
  "tests/s1",
  "tests/s2",
  "mapping-tests",
  "reporter-tests",
  "docs/test-plan.md",
  "pages/CookiePage.js",
  "fixtures/address.json",
  "fixtures/billingAddress.json",
  "fixtures/customer.json",
];

function walkFiles(target, files = []) {
  if (!fs.existsSync(target)) return files;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    files.push(target);
    return files;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) walkFiles(child, files);
    else files.push(child);
  }
  return files;
}

const runtimeRoots = [
  "Jenkinsfile",
  "package.json",
  "playwright.config.js",
  "scripts",
  "utils",
  "config",
  "reporters",
  "tests",
  "test-mapping/mx-qst-coverage.json",
  "test-mapping/pe-qst-reuse-plan.json",
].flatMap((entry) => walkFiles(path.join(root, entry)));

const staleRuntimeReferences = [];
for (const file of runtimeRoots) {
  if (!/\.(?:js|cjs|mjs|json)$/.test(file) && path.basename(file) !== "Jenkinsfile") continue;
  const source = fs.readFileSync(file, "utf8");
  const matches = [...source.matchAll(/tests\/(?:s1|s2)\/[A-Za-z0-9_./-]*/g)];
  if (!matches.length) continue;
  staleRuntimeReferences.push({
    file: path.relative(root, file).replace(/\\/g, "/"),
    refs: [...new Set(matches.map((match) => match[0]))],
  });
}

const missing = required.filter((entry) => !exists(entry));
const resurrected = forbidden.filter((entry) => exists(entry));

if (missing.length || resurrected.length || staleRuntimeReferences.length) {
  console.error("[repo-architecture] FAIL");
  if (missing.length) {
    console.error(`Missing required architecture paths: ${missing.join(", ")}`);
  }
  if (resurrected.length) {
    console.error(`Legacy paths must not return: ${resurrected.join(", ")}`);
  }
  for (const item of staleRuntimeReferences) {
    console.error(`Stale environment-first runtime reference in ${item.file}: ${item.refs.join(", ")}`);
  }
  process.exit(1);
}

console.log("[repo-architecture] PASS");
console.log("[repo-architecture] Executable tests use tests/markets/<market>/<qst|dst> plus explicit tests/shared and tests/legacy boundaries.");
console.log("[repo-architecture] S1/S2 no longer define physical test ownership; environment is runtime configuration.");
console.log("[repo-architecture] Current MX/PE governance mappings use canonical/explicit-legacy paths.");
console.log("[repo-architecture] Reporting tests are consolidated under reporters/tests.");
console.log("[repo-architecture] Governance tests are consolidated under test-mapping/tests.");
console.log("[repo-architecture] PE non-payment fixtures are namespaced under fixtures/pe.");
