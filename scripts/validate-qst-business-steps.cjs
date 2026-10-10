const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve("tests/markets");
const MARKETS = ["mx", "pe", "co", "cl"];
const MARKET_ROOTS = Object.freeze({
  mx: path.join(ROOT, "mx", "qst"),
  pe: path.join(ROOT, "pe", "qst"),
  co: path.join(ROOT, "co", "qst"),
  cl: path.join(ROOT, "cl", "qst"),
});

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else if (/\.spec\.[cm]?js$/i.test(entry.name)) files.push(target);
  }
  return files;
}

function collectStepHelpers(source) {
  const helpers = new Set();
  const patterns = [
    /(?:export\s+)?async\s+function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g,
    /(?:export\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g,
    /const\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\};/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      if (/\btest\.step\s*\(/.test(match[2])) helpers.add(match[1]);
    }
  }
  return helpers;
}

function resolveImport(fromFile, request) {
  if (!request.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [base, `${base}.js`, `${base}.cjs`, `${base}.mjs`, path.join(base, "index.js")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function collectImportedSteppedHelpers(file, source) {
  const stepped = new Set();
  const importExpression = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let match;
  while ((match = importExpression.exec(source))) {
    const target = resolveImport(file, match[2]);
    if (!target) continue;
    const importedSource = fs.readFileSync(target, "utf8");
    const exportedStepped = collectStepHelpers(importedSource);
    const names = match[1]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const parts = value.split(/\s+as\s+/i).map((part) => part.trim());
        return { exported: parts[0], local: parts[1] || parts[0] };
      });
    for (const { exported, local } of names) {
      if (exportedStepped.has(exported)) stepped.add(local);
    }
  }
  return stepped;
}

function collectLiteralTests(source) {
  const tests = [];
  const expression = /\btest(?:\.skip)?\s*\(\s*(["'`])([\s\S]*?)\1\s*,/g;
  let match;
  while ((match = expression.exec(source))) tests.push({ title: match[2], index: match.index, bodyStart: expression.lastIndex });
  return tests;
}

function relative(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, "/");
}

function marketFromTitle(title) {
  return title.match(/@(mx|pe|co|cl)\b/i)?.[1]?.toLowerCase() || null;
}

const errors = [];
const summary = Object.fromEntries(MARKETS.map((market) => [market, { audited: 0, covered: 0, blocked: 0 }]));

for (const market of MARKETS) {
  for (const file of walk(MARKET_ROOTS[market])) {
    const source = fs.readFileSync(file, "utf8");
    const localStepHelpers = collectStepHelpers(source);
    const importedStepHelpers = collectImportedSteppedHelpers(file, source);
    const tests = collectLiteralTests(source);

    for (let index = 0; index < tests.length; index += 1) {
      const current = tests[index];
      const title = current.title;
      if (!/SAM-\d+/i.test(title) || !/@qst\b/i.test(title)) continue;
      if (marketFromTitle(title) && marketFromTitle(title) !== market) continue;

      if (/@blocked\b/i.test(title)) {
        summary[market].blocked += 1;
        continue;
      }

      summary[market].audited += 1;
      const nextIndex = tests[index + 1]?.index ?? source.length;
      const testSource = source.slice(current.index, nextIndex);
      const explicitStep = /\btest\.step\s*\(/.test(testSource);
      const callsSteppedHelper = [...localStepHelpers, ...importedStepHelpers].some((helper) =>
        new RegExp(`\\b${helper}\\s*\\(`).test(testSource)
      );

      if (explicitStep || callsSteppedHelper) {
        summary[market].covered += 1;
        continue;
      }

      const samId = title.match(/SAM-\d+/i)?.[0] || "UNKNOWN";
      errors.push(`${market.toUpperCase()} ${samId}: no report-visible business test.step in the TC or a proven stepped helper (${relative(file)}).`);
    }
  }
}

console.log("[qst-business-steps] Business-step audit · active Base Store + EPP lanes");
for (const market of MARKETS) {
  const current = summary[market];
  console.log(
    `[qst-business-steps] ${market.toUpperCase()}: covered ${current.covered}/${current.audited} executable literal QST TCs` +
    (current.blocked ? ` · blocked ignored ${current.blocked}` : "")
  );
}

if (errors.length) {
  console.error("[qst-business-steps] FAIL");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("[qst-business-steps] PASS · every executable literal QST case exposes report-visible business steps; fixture-only wrappers are rejected in all markets.");