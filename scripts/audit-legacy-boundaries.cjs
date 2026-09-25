const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "test-results",
  "playwright-report",
  "allure-report",
  "allure-results",
  ".auth",
]);

// These paths are the temporary compatibility sources themselves. References
// *inside* them are irrelevant to the consumer audit because they disappear as
// a unit after acceptance.
const ignoredPrefixes = [
  "tests/s1/",
  "tests/s2/",
  "reporters/",
  "test-mapping/",
];

const patterns = [
  { label: "environment-test-tree", regex: /tests\/(?:s1|s2)\//g },
  { label: "reporting-compatibility", regex: /(?:^|["'`(\s./])reporters\//g },
  { label: "governance-compatibility", regex: /(?:^|["'`(\s./])test-mapping\//g },
];

const textExtensions = new Set([
  ".js", ".cjs", ".mjs", ".json", ".md", ".txt", ".yml", ".yaml",
  ".groovy", ".xml", ".html", ".css", ".ts",
]);
const explicitFiles = new Set(["Jenkinsfile", "package.json", "playwright.config.js"]);

function walk(current, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).replace(/\\/g, "/");
    if (ignoredPrefixes.some((prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) walk(absolute, out);
    else if (entry.isFile() && (explicitFiles.has(entry.name) || textExtensions.has(path.extname(entry.name).toLowerCase()))) out.push({ absolute, relative });
  }
  return out;
}

const findings = [];
for (const { absolute, relative } of walk(root)) {
  const source = fs.readFileSync(absolute, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({
          kind: pattern.label,
          file: relative,
          line: index + 1,
          text: line.trim().slice(0, 240),
        });
      }
    }
  });
}

const actionable = findings.filter(({ file }) =>
  !file.startsWith("docs/") &&
  !file.endsWith("audit-legacy-boundaries.cjs") &&
  !file.endsWith("validate-test-mirrors.cjs") &&
  !file.endsWith("validate-repository-architecture.cjs")
);

console.log("[legacy-boundary-audit] Compatibility references outside hidden mirror roots");
if (!findings.length) {
  console.log("[legacy-boundary-audit] none");
} else {
  const grouped = new Map();
  for (const finding of findings) {
    const list = grouped.get(finding.kind) || [];
    list.push(finding);
    grouped.set(finding.kind, list);
  }
  for (const [kind, rows] of grouped) {
    console.log(`\n${kind} (${rows.length})`);
    for (const row of rows) console.log(`- ${row.file}:${row.line} ${row.text}`);
  }
}

console.log(`\n[legacy-boundary-audit] total=${findings.length} actionable=${actionable.length}`);
if (actionable.length) {
  console.log("[legacy-boundary-audit] Actionable runtime/code references remain; migrate before physical compatibility deletion.");
  if (strict) process.exitCode = 1;
} else {
  console.log("[legacy-boundary-audit] No actionable runtime/code references remain. Documentation/migration guards may still mention compatibility paths intentionally.");
}
