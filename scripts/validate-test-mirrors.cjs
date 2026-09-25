const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");

// Temporary compatibility -> canonical pairs. These mirrors exist only while
// callers are migrated incrementally. They must stay byte-identical until the
// compatibility side can be deleted after runtime validation.
const mirrors = [
  ["tests/s1/mx", "tests/markets/mx"],
  ["tests/s1/pe", "tests/markets/pe"],
  ["tests/s1/smb", "tests/markets/shared"],
  ["tests/s2/pe", "tests/legacy/pe-s2"],
  ["reporters", "reporting"],
  ["test-mapping", "governance"],
];

function filesUnder(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return null;
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) out.push(path.relative(absoluteRoot, absolute).replace(/\\/g, "/"));
    }
  }
  walk(absoluteRoot);
  return out.sort();
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const failures = [];
for (const [compatibility, canonical] of mirrors) {
  const left = filesUnder(compatibility);
  const right = filesUnder(canonical);
  if (!left || !right) {
    failures.push(`${compatibility} <-> ${canonical}: missing tree`);
    continue;
  }
  const all = [...new Set([...left, ...right])].sort();
  for (const relative of all) {
    if (!left.includes(relative)) {
      failures.push(`${canonical}/${relative}: missing from compatibility source`);
      continue;
    }
    if (!right.includes(relative)) {
      failures.push(`${canonical}/${relative}: missing canonical mirror`);
      continue;
    }
    const leftFile = path.join(root, compatibility, relative);
    const rightFile = path.join(root, canonical, relative);
    if (digest(leftFile) !== digest(rightFile)) {
      failures.push(`${canonical}/${relative}: content drift from ${compatibility}/${relative}`);
    }
  }
}

if (failures.length) {
  console.error("[architecture-mirrors] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[architecture-mirrors] PASS");
console.log("[architecture-mirrors] Canonical trees match temporary compatibility sources byte-for-byte.");
