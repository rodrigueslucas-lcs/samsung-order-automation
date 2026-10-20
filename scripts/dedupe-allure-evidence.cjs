const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure-dedupe] Results directory does not exist; nothing to process.");
  process.exit(0);
}

const TECHNICAL_STEP = /^(before hooks?|after hooks?|locator|expect\b|wait for|waitfor|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b|click\b|fill\b|type\b|blur\b|press\b|scroll\b)/i;

function kindOf(attachment = {}) {
  const name = String(attachment.name || "");
  const type = String(attachment.type || "");
  const source = String(attachment.source || "");
  if (/screenshot/i.test(name) || /^image\//i.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(source)) return "screenshot";
  if (/trace/i.test(name) || /\.zip$/i.test(source)) return "trace";
  if (/video/i.test(name) || /^video\//i.test(type) || /\.(webm|mp4)$/i.test(source)) return "video";
  if (/error[ ._-]*context/i.test(name) || /\.md$/i.test(source)) return "error-context";
  return "artifact";
}

function displayName(kind, current) {
  if (kind === "screenshot") return "Screenshot · Final state";
  if (kind === "trace") return "Playwright Trace";
  if (kind === "video") return "Video · Execution";
  if (kind === "error-context") return "Error Context";
  return current || "Evidence";
}

function sourceExists(attachment = {}) {
  const source = String(attachment.source || "").trim();
  if (!source) return false;
  return fs.existsSync(path.join(resultsDir, source));
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
    // Allure expects attachment sources to exist inside allure-results. A dangling
    // source can make the generated detail view fail to render/fetch correctly.
    if (!sourceExists(attachment)) continue;
    const key = fingerprint(attachment);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = kindOf(attachment);
    attachment.name = displayName(kind, attachment.name);
    kept.push(attachment);
  }
  return kept;
}

function cleanSteps(steps, seen) {
  if (!Array.isArray(steps)) return [];
  const cleaned = [];
  for (const step of steps) {
    const name = String(step?.name || "").trim();
    if (!name || TECHNICAL_STEP.test(name)) continue;
    step.attachments = dedupeList(step.attachments, seen);
    step.steps = cleanSteps(step.steps, seen);
    cleaned.push(step);
  }
  return cleaned;
}

function parameterValue(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || null;
}

function mappedDefectTitle(result) {
  const description = String(result.description || "");
  const match = description.match(/\*\*Known defect:\*\*[^\n]*?·\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}

function hardenKnownDefect(result) {
  const knownDefect = parameterValue(result, "Known Defect");
  const runtimeStatus = String(parameterValue(result, "Runtime Status") || "").toUpperCase();
  if (!knownDefect || runtimeStatus !== "BLOCKED") return false;

  const defectTitle = mappedDefectTitle(result);
  const defectSummary = defectTitle ? `${knownDefect} · ${defectTitle}` : knownDefect;

  // "blocked" is not an Allure result status. Keep the business meaning in
  // parameters/description, while representing the non-gating runtime as skipped.
  result.status = "skipped";
  result.stage = "finished";
  result.statusDetails = {
    message: `Known Defect ${defectSummary}: execution is blocked/non-gating. See the linked Jira defect and preserved evidence for details.`,
    trace: "",
  };

  if (!Array.isArray(result.steps) || result.steps.length === 0) {
    const start = Number(result.start || Date.now());
    const stop = Number(result.stop || start);
    result.steps = [{
      name: `Blocked by Known Defect ${knownDefect}`,
      status: "skipped",
      stage: "finished",
      start,
      stop,
      steps: [],
      attachments: [],
      parameters: [],
      statusDetails: {
        message: `Official scenario was not counted as a functional failure because ${defectSummary} is an active mapped defect.`,
      },
    }];
  }
  return true;
}

let files = 0;
let removed = 0;
let hardened = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  const seen = new Set();

  result.attachments = dedupeList(result.attachments, seen);
  result.steps = cleanSteps(result.steps, seen);
  if (hardenKnownDefect(result)) hardened += 1;

  const after = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  removed += Math.max(0, before - after);
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(`[allure-dedupe] Processed ${files} result file(s); removed ${removed} duplicate/dangling attachment(s); hardened ${hardened} blocked known-defect result(s).`);
