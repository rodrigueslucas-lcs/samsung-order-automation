const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const removedCompatibilityRoots = ["tests/s1", "tests/s2", "tests/legacy"];
const remaining = removedCompatibilityRoots.filter((entry) => fs.existsSync(path.join(root, entry)));

if (remaining.length) {
  console.error("[architecture-compatibility] FAIL");
  console.error(`[architecture-compatibility] Removed compatibility roots must not return: ${remaining.join(", ")}`);
  process.exit(1);
}

console.log("[architecture-compatibility] PASS");
console.log("[architecture-compatibility] No environment-named or legacy test mirrors remain; tests/markets is authoritative.");
