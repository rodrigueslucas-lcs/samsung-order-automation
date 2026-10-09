const fs = require("node:fs");
const path = require("node:path");
const registry = require("../governance/smb-qst.json");
const { testTitles, officialIdsFromTitle } = require("../utils/qstS1Implementation");

const root = path.resolve(__dirname, "..");
const canonicalQstRoot = path.join(root, "tests/markets/pe/qst");
const canonicalDstRoot = path.join(root, "tests/markets/pe/dst");
const strict = process.argv.includes("--strict");

function walkSpecs(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSpecs(target));
    else if (/\.spec\.[cm]?js$/i.test(entry.name)) files.push(target);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function inventory(directory) {
  return walkSpecs(directory).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return testTitles(source).map((title) => ({ file: rel(file), title, officialIds: officialIdsFromTitle(title) }));
  });
}

const canonical = inventory(canonicalQstRoot);
const officialIds = new Set(registry.markets?.PE?.cases || []);
const canonicalById = new Map();

for (const entry of canonical) {
  for (const id of entry.officialIds) {
    const previous = canonicalById.get(id) || [];
    previous.push(entry);
    canonicalById.set(id, previous);
  }
}

const duplicateCanonical = [...canonicalById].filter(([, entries]) => entries.length > 1);
const unknownCanonical = [...canonicalById.keys()].filter((id) => !officialIds.has(id));
const implementedOfficial = [...canonicalById.keys()].filter((id) => officialIds.has(id)).sort();
const missingOfficial = [...officialIds].filter((id) => !canonicalById.has(id)).sort();
const dstSpecs = walkSpecs(canonicalDstRoot);
const requiredDstStores = ["base-store", "epp", "backoffice"];
const missingDstStores = requiredDstStores.filter((store) => !fs.existsSync(path.join(canonicalDstRoot, store)));
const removedRoots = ["tests/legacy", "tests/s1", "tests/s2"].filter((entry) => fs.existsSync(path.join(root, entry)));

console.log("PE CANONICAL GENERATION AUDIT");
console.log("=============================");
console.log(`Official historical PE QST registry: ${officialIds.size}`);
console.log(`Canonical PE QST specs: ${new Set(canonical.map(({ file }) => file)).size}`);
console.log(`Canonical Playwright QST tests: ${canonical.length}`);
console.log(`Canonical official SAM IDs implemented: ${implementedOfficial.length}`);
console.log(`Official SAM IDs not yet represented canonically: ${missingOfficial.length}`);
console.log(`Canonical PE DST specs: ${dstSpecs.length}`);
console.log(`Removed compatibility roots present: ${removedRoots.length}`);

if (duplicateCanonical.length) {
  console.log("\nDuplicate canonical official IDs:");
  for (const [id, entries] of duplicateCanonical) console.log(`- ${id}: ${entries.map(({ file }) => file).join(", ")}`);
}
if (unknownCanonical.length) console.log(`\nCanonical IDs outside historical PE registry: ${unknownCanonical.join(", ")}`);
if (missingDstStores.length) console.log(`\nMissing canonical PE DST stores: ${missingDstStores.join(", ")}`);
if (removedRoots.length) console.log(`\nCompatibility roots that must remain deleted: ${removedRoots.join(", ")}`);

console.log("\nPolicy:");
console.log("- tests/markets/pe/qst is authoritative for PE QST.");
console.log("- tests/markets/pe/dst is authoritative for established PE DST coverage.");
console.log("- environment-named and legacy test roots are no longer executable architecture.");
console.log("- official scope, implementation presence and runtime proof remain separate dimensions.");

const hardFailures = [
  ...duplicateCanonical.map(([id]) => `duplicate canonical ${id}`),
  ...unknownCanonical.map((id) => `unknown canonical ${id}`),
  ...missingDstStores.map((store) => `missing canonical DST ${store}`),
  ...removedRoots.map((entry) => `compatibility root resurrected ${entry}`),
];

if (strict && hardFailures.length) {
  console.error(`\n[pe-generation-audit] FAIL: ${hardFailures.join("; ")}`);
  process.exit(1);
}

console.log(`\n[pe-generation-audit] ${hardFailures.length ? "REVIEW" : "PASS"}`);
