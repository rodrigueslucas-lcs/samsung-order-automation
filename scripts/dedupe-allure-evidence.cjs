const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure-dedupe] Results directory does not exist; nothing to process.");
  process.exit(0);
}

function kindOf(attachment = {}) {
  const name = String(attachment.name || "");
  const type = String(attachment.type || "");
  const source = String(attachment.source || "");
  if (/screenshot/i.test(name) || /^image\//i.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(source)) return "screenshot";
  if (/trace/i.test(name) || /\.zip$/i.test(source)) return "trace";
  if (/video/i.test(name) || /^video\//i.test(type) || /\.(webm|mp4)$/i.test(source)) return "video";
  if (/error.context|context/i.test(name) || /\.md$/i.test(source)) return "context";
  return "artifact";
}

function displayName(kind, current) {
  if (kind === "screenshot") return "Screenshot · Final state";
  if (kind === "trace") return "Playwright Trace";
  if (kind === "video") return "Video · Execution";
  if (kind === "context") return "Error Context";
  return current || "Evidence";
}

function fingerprint(attachment = {}) {
  const source = String(attachment.source || "");
  if (!source) return `meta:${kindOf(attachment)}:${attachment.name || ""}:${attachment.type || ""}`;
  const file = path.join(resultsDir, source);
  try {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    return `sha256:${hash}`;
  } catch {
    return `source:${source}`;
  }
}

function dedupeList(list, seen) {
  if (!Array.isArray(list)) return [];
  const kept = [];
  for (const attachment of list) {
    const key = fingerprint(attachment);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = kindOf(attachment);
    attachment.name = displayName(kind, attachment.name);
    kept.push(attachment);
  }
  return kept;
}

function visitSteps(steps, seen) {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    step.attachments = dedupeList(step.attachments, seen);
    visitSteps(step.steps, seen);
  }
}

let files = 0;
let removed = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  const seen = new Set();

  // Keep the business-facing top-level evidence first, then remove byte-identical
  // copies nested under Playwright adapter steps/hooks. Distinct screenshots are
  // preserved because deduplication is based on file content, not attachment type.
  result.attachments = dedupeList(result.attachments, seen);
  visitSteps(result.steps, seen);

  const after = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  removed += Math.max(0, before - after);
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(`[allure-dedupe] Processed ${files} result file(s); removed ${removed} byte-identical duplicate attachment(s).`);
