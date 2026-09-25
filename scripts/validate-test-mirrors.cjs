const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

// Remaining temporary compatibility -> canonical pairs. MX runtime acceptance
// and canonical reporting/governance integrity are proven, so those accepted
// compatibility roots are no longer mirrored here.
const mirrors = [
  ["tests/s1/pe", "tests/markets/pe"],
  ["tests/s1/smb", "tests/markets/shared"],
  ["tests/s2/pe", "tests/legacy/pe-s2"],
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

const drift = [];
for (const [compatibility, canonical] of mirrors) {
  const left = filesUnder(compatibility);
  const right = filesUnder(canonical);
  if (!left || !right) {
    drift.push(`${compatibility} <-> ${canonical}: one side is absent (expected after compatibility deletion)`);
    continue;
  }
  const all = [...new Set([...left, ...right])].sort();
  for (const relative of all) {
    if (!left.includes(relative)) {
      drift.push(`${canonical}/${relative}: canonical-only file`);
      continue;
    }
    if (!right.includes(relative)) {
      drift.push(`${compatibility}/${relative}: compatibility-only file`);
      continue;
    }
    const leftFile = path.join(root, compatibility, relative);
    const rightFile = path.join(root, canonical, relative);
    if (digest(leftFile) !== digest(rightFile)) {
      drift.push(`${canonical}/${relative}: differs from frozen compatibility copy ${compatibility}/${relative}`);
    }
  }
}

if (!drift.length) {
  console.log("[architecture-compatibility] PASS");
  console.log("[architecture-compatibility] No compatibility drift detected.");
  process.exit(0);
}

console.log(`[architecture-compatibility] DRIFT (${drift.length})`);
for (const item of drift) console.log(`- ${item}`);
console.log("[architecture-compatibility] Canonical trees remain authoritative; compatibility copies are frozen rollback material pending runtime acceptance.");
if (strict) {
  console.error("[architecture-compatibility] Strict mode requested; drift is blocking.");
  process.exitCode = 1;
}
