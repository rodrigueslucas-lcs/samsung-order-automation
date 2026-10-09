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

const patterns = [
  { label: "removed-test-tree", regex: /tests\/(?:s1|s2|legacy)\//g },
  { label: "reporting-compatibility", regex: /(?:^|["'`(\s./])reporters\//g },
  { label: "governance-compatibility", regex: /(?:^|["'`(\s./])test-mapping\//g },
];

const textExtensions = new Set([
  ".js", ".cjs", ".mjs", ".json", ".md", ".txt", ".yml", ".yaml",
  ".groovy", ".xml", ".html", ".css", ".ts",
]);
const explicitFiles = new Set(["Jenkinsfile", "package.json", "playwright.config.js"]);
const selfFiles = new Set([
  "scripts/audit-legacy-boundaries.cjs",
  "scripts/validate-test-mirrors.cjs",
  "scripts/validate-repository-architecture.cjs",
]);
const historicalMetadata = new Set([
  "governance/pe-qst-reuse-plan.json",
]);

function walk(current, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) walk(absolute, out);
    else if (entry.isFile() && (explicitFiles.has(entry.name) || textExtensions.has(path.extname(entry.name).toLowerCase()))) {
      out.push({ absolute, relative: path.relative(root, absolute).replace(/\\/g, "/") });
    }
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
        findings.push({ kind: pattern.label, file: relative, line: index + 1, text: line.trim().slice(0, 240) });
      }
    }
  });
}

const actionable = findings.filter(({ file }) =>
  path.extname(file).toLowerCase() !== ".md" &&
  !selfFiles.has(file) &&
  !historicalMetadata.has(file)
);

console.log("[legacy-boundary-audit] References to removed compatibility boundaries");
if (!findings.length) console.log("[legacy-boundary-audit] none");
else {
  const grouped = new Map();
  for (const finding of findings) {
    const rows = grouped.get(finding.kind) || [];
    rows.push(finding);
    grouped.set(finding.kind, rows);
  }
  for (const [kind, rows] of grouped) {
    console.log(`\n${kind} (${rows.length})`);
    for (const row of rows) console.log(`- ${row.file}:${row.line} ${row.text}`);
  }
}

console.log(`\n[legacy-boundary-audit] total=${findings.length} actionable=${actionable.length}`);
if (actionable.length) {
  console.log("[legacy-boundary-audit] Actionable code/config references to removed compatibility paths remain.");
  if (strict) process.exitCode = 1;
} else {
  console.log("[legacy-boundary-audit] No actionable code/config references depend on removed compatibility paths.");
}
