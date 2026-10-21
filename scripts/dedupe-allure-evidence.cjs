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
  return defect;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim();
}

function descriptionField(description, labels) {
  const source = String(description || "");
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n]+)`, "i"));
    if (match?.[1]) return cleanText(match[1].replace(/\s{2,}$/g, ""));
  }
  return null;
}

function technicalDetail(result) {
  const message = cleanText(result.statusDetails?.message || "");
  const trace = cleanText(result.statusDetails?.trace || "");
  const source = message || trace;
  if (!source) return "";
  return source.split("\n").slice(0, 8).join("\n").slice(0, 1400).trim();
}

function humanizeDetail(detail) {
  const text = cleanText(detail);
  if (!text) return null;

  const missingText = text.match(/getByText\(['\"]([^'\"]+)['\"]/i)?.[1];
  if (missingText && /not found|toBeVisible|expected.*visible/i.test(text)) {
    return `Expected value or storefront content "${missingText}" was not visible after the business action completed.`;
  }

  const receivedUrl = text.match(/Received string:\s*["']([^"']+)["']/i)?.[1];
  if (receivedUrl && /toHaveURL|Expected pattern/i.test(text)) {
    return `Navigation did not reach the expected destination; the browser remained at ${receivedUrl}.`;
  }

  if (/AUTOMATION_RECOVERY_EXHAUSTED/i.test(text)) {
    return "The controlled recovery cycle was exhausted before the storefront reached the required stable state.";
  }
  if (/PAYMENT_OUTCOME_UNCONFIRMED/i.test(text)) {
    return "The payment attempt produced an ambiguous outcome and was intentionally not submitted again to avoid duplicate orders or charges.";
  }
  if (/timeout|timed out|exceeded/i.test(text)) {
    return "The scenario exceeded its bounded wait/recovery window before the expected storefront state became available.";
  }

  return text.split("\n")[0].replace(/^Error:\s*/i, "").slice(0, 420);
}

function actualResult(result, defect) {
  const status = businessStatus(result);
  const detail = technicalDetail(result);
  const readable = humanizeDetail(detail);
  if (defect && status === "BLOCKED") return `BLOCKED / KNOWN DEFECT ${defect.jira} — ${readable || defect.title || "mapped active defect"}`;
  if (defect && status === "FAIL") return `FAIL / KNOWN DEFECT ${defect.jira} — ${readable || defect.title || "mapped active defect"}`;
  if (status === "PASS") return "PASS — all automated assertions executed for this scenario were satisfied.";
  if (status === "BLOCKED") return readable ? `BLOCKED — ${readable}` : "BLOCKED — execution did not proceed because a prerequisite was unavailable.";
  if (status === "FAIL") return readable ? `FAIL — ${readable}` : "FAIL — the automated validation did not satisfy the expected result.";
  return "NOT RUN — no executable runtime result was produced for this scenario.";
}

function scenarioTitle(result) {
  const samId = samIdOf(result);
  const name = cleanText(result.name || result.fullName || samId || "Official QST scenario");
  return name.replace(/^SAM-\d+\s*[·:\-]?\s*/i, "").trim() || name;
}

function parameterLines(result) {
  const preferred = [
    ["Market", "Market"],
    ["Environment", "Environment"],
    ["Store", "Store"],
    ["Feature", "Feature"],
    ["User Type", "User Type"],
    ["SKU", "SKU"],
    ["Payment", "Payment"],
    ["Order ID", "Order ID"],
    ["Runtime Status", "Runtime Status"],
    ["Coverage", "Automation Coverage"],
  ];
  return preferred
    .map(([name, label]) => {
      const value = parameterValue(result, name);
      return value ? `- **${label}:** ${cleanText(value)}` : null;
    })
    .filter(Boolean);
}

function normalizePresentation(result, defect) {
  const original = String(result.description || "");
  const samId = samIdOf(result);
  const status = businessStatus(result);
  const objective = descriptionField(original, ["Objective", "Validation goal", "Validation Goal"])
    || `Validate the official ${samId || "QST"} business scenario and preserve auditable execution evidence.`;
  const expected = descriptionField(original, ["Expected result", "Expected Result"])
    || "The official business acceptance criteria are satisfied and the observed storefront state matches the expected behavior.";
  const blocker = descriptionField(original, ["Blocker category", "Blocker Category"]);
  const detail = technicalDetail(result);
  const readable = humanizeDetail(detail);
  const title = scenarioTitle(result);
  const context = parameterLines(result);
  const lines = [
    `## ${samId ? `[${samId}](https://jira.secext.samsung.net/browse/${samId}) · ` : ""}${title}`,
    "",
    "### Validation Summary",
    `**Status:** ${defect ? `${status} / KNOWN DEFECT ${defect.jira}` : status}`,
    `**Validation goal:** ${objective}`,
    readable && status !== "PASS" ? `**What happened:** ${readable}` : null,
    "",
    "### Expected Result",
    expected,
    "",
    "### Actual Result",
    actualResult(result, defect),
    "",
    defect ? "### Known Defect" : null,
    defect ? `**[${defect.jira}](${defect.url}) — ${defect.title || defect.jira}**` : null,
    defect ? "This runtime result is mapped to an active defect for this exact market/environment/store/TC scope; raw execution evidence is preserved." : null,
    defect ? "" : null,
    status === "BLOCKED" ? "### Blocker / Prerequisite" : null,
    status === "BLOCKED" ? `**Category:** ${blocker || "Execution prerequisite"}` : null,
    status === "BLOCKED" ? (detail ? cleanText(detail.split("\n")[0]) : "A required prerequisite was unavailable, so the business scenario did not proceed to its final assertion.") : null,
    status === "BLOCKED" ? "" : null,
    status === "FAIL" ? "### Technical Error" : null,
    status === "FAIL" ? "The business result above is the primary interpretation. The technical failure below is retained for engineering diagnosis:" : null,
    status === "FAIL" && detail ? "```text" : null,
    status === "FAIL" && detail ? detail : null,
    status === "FAIL" && detail ? "```" : null,
    status === "FAIL" ? "" : null,
    "### Execution Context",
    ...context,
    "",
    "### Links & Evidence",
    samId ? `- **Official TC:** [${samId}](https://jira.secext.samsung.net/browse/${samId})` : null,
    defect ? `- **Mapped defect:** [${defect.jira}](${defect.url})` : null,
    "- **Evidence:** business steps, curated request/response attachments when captured, screenshot/video and Playwright Trace remain attached to this result.",
    "",
    "_Business interpretation is shown first; low-level browser/network detail remains available for debugging without overwhelming the validation summary._",
  ].filter((line) => line !== null && line !== undefined);

  result.description = lines.join("\n");
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
let normalized = 0;

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  const seen = new Set();

  result.attachments = dedupeList(result.attachments, seen);
  result.steps = cleanSteps(result.steps, seen);
  const defect = ensureKnownDefectMetadata(result);
  if (defect) mapped += 1;

  if (samIdOf(result)) {
    normalizePresentation(result, defect);
    normalized += 1;
  }

  if (hardenKnownDefect(result)) hardened += 1;

  const after = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  removed += Math.max(0, before - after);
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(`[allure-dedupe] Processed ${files} result file(s); removed ${removed} duplicate/dangling attachment(s); mapped ${mapped} known defect result(s); normalized ${normalized} business-readable result(s); hardened ${hardened} blocked known-defect result(s).`);
