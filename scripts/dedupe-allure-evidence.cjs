const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");
const registryFile = path.resolve("governance/known-defects.json");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure-dedupe] Results directory does not exist; nothing to process.");
  process.exit(0);
}

const TECHNICAL_STEP = /^(before hooks?|after hooks?|locator|expect\b|wait for|waitfor|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b|click\b|fill\b|type\b|blur\b|press\b|scroll\b)/i;
const registry = (() => {
  try { return JSON.parse(fs.readFileSync(registryFile, "utf8")); } catch { return { defects: [] }; }
})();

function normalizeEnvironment(value) {
  const text = String(value || "").toUpperCase();
  if (/S2|STG2|STAGING2|PREQA2/.test(text)) return "S2";
  if (/S1|STG1|STAGING1/.test(text)) return "S1";
  return text;
}

function normalizeStore(value) {
  const text = String(value || "").toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  return text === "BS" || text === "BASESTORE" ? "BASE_STORE" : text;
}

function parameterValue(result, name) {
  return (result.parameters || []).find((item) => item?.name === name)?.value || null;
}

function businessStatus(result) {
  const explicit = String(parameterValue(result, "Runtime Status") || "").toUpperCase();
  if (explicit) {
    if (/BLOCKED|SKIPPED/.test(explicit)) return "BLOCKED";
    if (/PASS/.test(explicit)) return "PASS";
    if (/FAIL|UNEXPECTED|TIMEDOUT|INTERRUPTED/.test(explicit)) return "FAIL";
  }
  const status = String(result.status || "").toLowerCase();
  if (status === "skipped") return "BLOCKED";
  if (status === "passed") return "PASS";
  if (["failed", "broken", "unknown"].includes(status)) return "FAIL";
  return "NOT_RUN";
}

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

function upsertParameter(result, name, value) {
  result.parameters = (result.parameters || []).filter((item) => item?.name !== name);
  if (value !== undefined && value !== null && value !== "") result.parameters.push({ name, value: String(value) });
}

function addTag(result, value) {
  result.labels ||= [];
  if (!result.labels.some((label) => label?.name === "tag" && label?.value === value)) result.labels.push({ name: "tag", value });
}

function samIdOf(result) {
  return `${result.name || ""} ${result.fullName || ""}`.match(/SAM-\d+/)?.[0] || null;
}

function mappedDefect(result) {
  const status = businessStatus(result);
  if (!["FAIL", "BLOCKED"].includes(status)) return null;
  const samId = samIdOf(result);
  if (!samId) return null;
  const market = String(parameterValue(result, "Market") || "").toUpperCase();
  const environment = normalizeEnvironment(parameterValue(result, "Environment"));
  const store = normalizeStore(parameterValue(result, "Store"));
  return (registry.defects || []).find((defect) =>
    String(defect.market || "").toUpperCase() === market &&
    normalizeEnvironment(defect.environment) === environment &&
    (!defect.store || !store || normalizeStore(defect.store) === store) &&
    String(defect.samId || "").toUpperCase() === samId &&
    String(defect.status || "OPEN").toUpperCase() !== "CLOSED"
  ) || null;
}

function ensureKnownDefectMetadata(result) {
  const defect = mappedDefect(result);
  if (!defect) return null;
  upsertParameter(result, "Runtime Status", businessStatus(result));
  upsertParameter(result, "Known Defect", defect.jira);
  upsertParameter(result, "Known Defect Title", defect.title || defect.jira);
  addTag(result, "known-defect");
  result.links ||= [];
  result.links = result.links.filter((link) => link?.name !== defect.jira);
  if (defect.url) result.links.push({ name: defect.jira, url: defect.url, type: "issue" });
  if (!String(result.description || "").includes("**Known defect:**")) {
    result.description = `${String(result.description || "").trim()}\n\n**Known defect:** [${defect.jira}](${defect.url}) · ${defect.title || defect.jira}`.trim();
  }
  return defect;
}

function actualResult(result, defect) {
  const status = businessStatus(result);
  const detail = String(result.statusDetails?.message || "").split("\n")[0].trim();
  if (defect && status === "BLOCKED") return `BLOCKED / KNOWN DEFECT ${defect.jira} — ${defect.title || "mapped active defect"}.`;
  if (defect && status === "FAIL") return `FAIL / KNOWN DEFECT ${defect.jira} — ${defect.title || "mapped active defect"}.`;
  if (status === "PASS") return "PASS — all automated assertions executed for this scenario were satisfied.";
  if (status === "BLOCKED") return detail ? `BLOCKED — ${detail}` : "BLOCKED — execution did not proceed because a prerequisite was unavailable.";
  if (status === "FAIL") return detail ? `FAIL — ${detail}` : "FAIL — the automated validation did not satisfy the expected result.";
  return "NOT RUN — no executable runtime result was produced for this scenario.";
}

function ensureActualResult(result, defect) {
  const description = String(result.description || "");
  if (description.includes("**Actual result:**")) return;
  const line = `**Actual result:** ${actualResult(result, defect)}`;
  if (/\*\*Expected result:\*\*/.test(description)) {
    result.description = description.replace(/(\*\*Expected result:\*\*[^\n]*(?:\n|$))/, `$1${line}\n`);
  } else {
    result.description = `${description.trim()}\n\n${line}`.trim();
  }
}

function hardenKnownDefect(result) {
  const knownDefect = parameterValue(result, "Known Defect");
  const runtimeStatus = businessStatus(result);
  if (!knownDefect || runtimeStatus !== "BLOCKED") return false;

  const defectTitle = parameterValue(result, "Known Defect Title");
  const defectSummary = defectTitle ? `${knownDefect} · ${defectTitle}` : knownDefect;
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
let mapped = 0;
let actualResults = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  const seen = new Set();

  result.attachments = dedupeList(result.attachments, seen);
  result.steps = cleanSteps(result.steps, seen);
  const defect = ensureKnownDefectMetadata(result);
  if (defect) mapped += 1;
  const hadActual = String(result.description || "").includes("**Actual result:**");
  ensureActualResult(result, defect);
  if (!hadActual && String(result.description || "").includes("**Actual result:**")) actualResults += 1;
  if (hardenKnownDefect(result)) hardened += 1;

  const after = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  removed += Math.max(0, before - after);
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(`[allure-dedupe] Processed ${files} result file(s); removed ${removed} duplicate/dangling attachment(s); mapped ${mapped} known defect result(s); added ${actualResults} Actual Result field(s); hardened ${hardened} blocked known-defect result(s).`);
