const fs = require("node:fs");
const path = require("node:path");
const reusePlan = require("../governance/pe-qst-reuse-plan.json");
const registry = require("../governance/smb-qst.json");
const { testTitles, officialIdsFromTitle } = require("../utils/qstS1Implementation");

const root = path.resolve(__dirname, "..");
const canonicalRoot = path.join(root, "tests/markets/pe/qst");
const legacyRoot = path.join(root, "tests/legacy/pe-s2/qst");
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
    return testTitles(source).map((title) => ({
      file: rel(file),
      title,
      officialIds: officialIdsFromTitle(title),
      legacyIds: [...new Set(title.match(/QST-[A-Z]+-\d+/gi) || [])],
    }));
  });
}

const canonical = inventory(canonicalRoot);
const legacy = inventory(legacyRoot);
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

const candidatePathMap = new Map();
for (const [id, entry] of Object.entries(reusePlan.cases || {})) {
  if (!entry.candidate) continue;
  const canonicalCandidate = entry.candidate
    .replace(/^tests\/s2\/pe\//, "tests/legacy/pe-s2/")
    .replace(/^tests\/s1\/pe\//, "tests/markets/pe/");
  const ids = candidatePathMap.get(canonicalCandidate) || [];
  ids.push(id);
  candidatePathMap.set(canonicalCandidate, ids);
}

const missingLegacyCandidates = [...candidatePathMap.entries()]
  .filter(([candidate]) => !fs.existsSync(path.join(root, candidate)));

const orphanLegacySpecs = [...new Set(legacy.map(({ file }) => file))]
  .filter((file) => !candidatePathMap.has(file));

console.log("PE QST GENERATION AUDIT");
console.log("=======================");
console.log(`Official historical PE QST registry: ${officialIds.size}`);
console.log(`Canonical PE QST specs: ${new Set(canonical.map(({ file }) => file)).size}`);
console.log(`Canonical Playwright tests: ${canonical.length}`);
console.log(`Canonical official SAM IDs implemented: ${implementedOfficial.length}`);
console.log(`Official SAM IDs not yet represented canonically: ${missingOfficial.length}`);
console.log(`Legacy PE-S2 QST specs: ${new Set(legacy.map(({ file }) => file)).size}`);
console.log(`Legacy Playwright tests: ${legacy.length}`);
console.log(`Reuse-plan legacy candidate files: ${candidatePathMap.size}`);
console.log("");

if (implementedOfficial.length) {
  console.log(`Canonical official IDs: ${implementedOfficial.join(", ")}`);
}
if (missingOfficial.length) {
  console.log(`Missing canonical official IDs: ${missingOfficial.join(", ")}`);
}
if (duplicateCanonical.length) {
  console.log("\nDuplicate canonical official IDs:");
  for (const [id, entries] of duplicateCanonical) {
    console.log(`- ${id}: ${entries.map(({ file }) => file).join(", ")}`);
  }
}
if (unknownCanonical.length) {
  console.log(`\nCanonical IDs outside historical PE registry: ${unknownCanonical.join(", ")}`);
}
if (missingLegacyCandidates.length) {
  console.log("\nReuse-plan candidate paths that no longer exist:");
  for (const [candidate, ids] of missingLegacyCandidates) {
    console.log(`- ${candidate}: ${ids.join(", ")}`);
  }
}
if (orphanLegacySpecs.length) {
  console.log("\nLegacy QST specs not referenced by the PE reuse plan:");
  for (const file of orphanLegacySpecs) console.log(`- ${file}`);
}

console.log("\nPolicy:");
console.log("- tests/markets/pe is the only destination for new PE QST work.");
console.log("- tests/legacy/pe-s2 is migration input / established DST compatibility, not current environment taxonomy.");
console.log("- an old spec is deletable only after every business capability/consumer it carries is reconciled and runtime acceptance exists.");
console.log("- official scope, implementation presence and runtime proof remain separate dimensions.");

const hardFailures = [
  ...duplicateCanonical.map(([id]) => `duplicate canonical ${id}`),
  ...unknownCanonical.map((id) => `unknown canonical ${id}`),
  ...missingLegacyCandidates.map(([candidate]) => `missing reuse candidate ${candidate}`),
];

if (strict && hardFailures.length) {
  console.error(`\n[pe-generation-audit] FAIL: ${hardFailures.join("; ")}`);
  process.exit(1);
}

console.log(`\n[pe-generation-audit] ${hardFailures.length ? "REVIEW" : "PASS"}`);
