const { matchesKnownDefectEvidence } = require('../reporting/knownDefectEvidence.cjs');
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");
const registryFile = path.resolve("governance/known-defects.json");

if (!fs.existsSync(resultsDir)) {
  console.log("[allure-dedupe] Results directory does not exist; nothing to process.");
  process.exit(0);
}

// Allure already has Playwright Trace for browser-level diagnostics. Keep the visible
// result tree focused on business actions and remove reporter/API noise globally.
const TECHNICAL_STEP = /^(before hooks?|after hooks?|locator|expect\b|wait\b|wait for|waitfor|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b|click\b|fill\b|type\b|blur\b|press\b|scroll\b|scroll into view|screenshot\b|check\b|uncheck\b|hover\b|select option|set input files|goto\b|reload\b|focus\b|dispatch event)/i;

const registry = (() => {
  try { return JSON.parse(fs.readFileSync(registryFile, "utf8")); }
  catch { return { defects: [] }; }
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
  if (kind === "trace") return "Playwright Trace · Engineering detail";
  if (kind === "video") return "Video · Business execution";
  if (kind === "error-context") return "Error Context · Raw diagnostic";
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
  if (!result.labels.some((label) => label?.name === "tag" && label?.value === value)) {
    result.labels.push({ name: "tag", value });
  }
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
    String(defect.status || "OPEN").toUpperCase() !== "CLOSED" && matchesKnownDefectEvidence(defect, result)
  ) || null;
}

function ensureKnownDefectMetadata(result) {
  const defect = mappedDefect(result);
  if (!defect) return null;
  // Preserve raw runtime truth separately from the Allure visual/non-gating state.
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

function escapeHtml(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function descriptionField(description, labels) {
  const source = String(description || "");
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n]+)`, "i"),
      new RegExp(`^${escaped}:\\s*([^\\n]+)`, "im"),
      new RegExp(`^${escaped}\\s*\\n([^\\n]+)`, "im"),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return cleanText(match[1].replace(/\s{2,}$/g, ""));
    }
  }
  return null;
}

function technicalDetail(result) {
  const message = cleanText(result.statusDetails?.message || "");
  const trace = cleanText(result.statusDetails?.trace || "");
  const source = message || trace;
  if (!source) return "";
  return source.split("\n").slice(0, 10).join("\n").slice(0, 1800).trim();
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
  if (/credentials|required for checkout login|authentication/i.test(text)) {
    return "The scenario could not continue because a required authenticated-session prerequisite was unavailable.";
  }

  return text.split("\n")[0].replace(/^Error:\s*/i, "").slice(0, 420);
}

function actualResult(result, defect) {
  const status = businessStatus(result);
  const detail = technicalDetail(result);
  const readable = humanizeDetail(detail);
  if (defect && status === "BLOCKED") {
    return `Execution was blocked before the final business assertion. The TC remains linked to ${defect.jira}; the prerequisite blocker is preserved separately and the defect is not claimed as freshly reproduced.`;
  }
  if (defect && status === "FAIL") {
    return `Runtime failed and is mapped to active defect ${defect.jira}. ${readable || defect.title || "Raw evidence remains attached for engineering confirmation."}`;
  }
  if (status === "PASS") return "All automated assertions executed for this scenario were satisfied.";
  if (status === "BLOCKED") return readable || "Execution did not proceed because a required prerequisite was unavailable.";
  if (status === "FAIL") return readable || "The automated validation did not satisfy the expected business result.";
  return "No executable runtime result was produced for this scenario.";
}

function scenarioTitle(result) {
  const samId = samIdOf(result);
  const name = cleanText(result.name || result.fullName || samId || "Official QST scenario");
  return name.replace(/^SAM-\d+\s*[·:\-]?\s*/i, "").trim() || name;
}

function contextEntries(result) {
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
    ["Coverage", "Coverage"],
  ];
  return preferred
    .map(([name, label]) => {
      const value = parameterValue(result, name);
      return value ? [label, cleanText(value)] : null;
    })
    .filter(Boolean);
}

function statusVisual(status, defect) {
  if (defect) return { label: "KNOWN DEFECT", fg: "#6941c6", bg: "#f4f0ff", border: "#d9d0ff" };
  if (status === "PASS") return { label: "PASS", fg: "#067647", bg: "#ecfdf3", border: "#abefc6" };
  if (status === "BLOCKED") return { label: "BLOCKED", fg: "#b54708", bg: "#fffaeb", border: "#fedf89" };
  if (status === "FAIL") return { label: "FAIL", fg: "#b42318", bg: "#fef3f2", border: "#fecdca" };
  return { label: "NOT RUN", fg: "#475467", bg: "#f2f4f7", border: "#d0d5dd" };
}

function card(title, body, accent = "#d0d5dd", background = "#ffffff") {
  return `<section style="border:1px solid ${accent};border-left:4px solid ${accent};border-radius:8px;padding:12px 14px;margin:10px 0;background:${background}">` +
    `<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">${escapeHtml(title)}</div>` +
    `<div style="line-height:1.55">${body}</div></section>`;
}

function renderBusinessHtml(result, defect, model) {
  const { samId, title, status, objective, expected, observed, blocker, detail, context } = model;
  const visual = statusVisual(status, defect);
  const jiraUrl = samId ? `https://jira.secext.samsung.net/browse/${samId}` : null;
  const header = `<div style="margin-bottom:12px">` +
    `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">` +
    `<span style="display:inline-block;padding:4px 9px;border-radius:999px;font-weight:700;color:${visual.fg};background:${visual.bg};border:1px solid ${visual.border}">${visual.label}</span>` +
    (samId ? `<a href="${jiraUrl}" style="font-weight:700">${escapeHtml(samId)}</a>` : "") +
    `</div>` +
    `<h3 style="margin:8px 0 2px;font-size:18px">${escapeHtml(title)}</h3>` +
    `</div>`;

  const summary = card(
    "Resumo da validação",
    `<strong>O que foi validado:</strong> ${escapeHtml(objective)}` +
      (status !== "PASS" ? `<br><strong>Leitura do resultado:</strong> ${escapeHtml(observed)}` : ""),
    visual.border,
    visual.bg
  );

  const expectedCard = card("Resultado esperado", escapeHtml(expected), "#84caff", "#f5fbff");
  const observedCard = card("Resultado observado", escapeHtml(observededOrObserved(observed)), visual.border, visual.bg);

  let special = "";
  if (defect) {
    special += card(
      "Known Defect",
      `<strong><a href="${escapeHtml(defect.url || "#")}">${escapeHtml(defect.jira)}</a> — ${escapeHtml(defect.title || defect.jira)}</strong>` +
      `<br><span>Mapeamento ativo somente para este TC / market / environment / store. A evidência bruta do runtime continua preservada.</span>`,
      "#bdb4fe",
      "#f4f0ff"
    );
  }
  if (status === "BLOCKED") {
    special += card(
      "Pré-requisito / desbloqueio",
      `<strong>Categoria:</strong> ${escapeHtml(blocker || "Execution prerequisite")}` +
      `<br>${escapeHtml(humanizeDetail(detail) || detail.split("\n")[0] || "A required prerequisite must be restored before a conclusive validation can run.")}`,
      "#fec84b",
      "#fffaeb"
    );
  }
  if (status === "FAIL" && detail) {
    special += `<details style="margin:10px 0"><summary style="cursor:pointer;font-weight:700">Detalhe técnico (debug)</summary>` +
      `<pre style="white-space:pre-wrap;border:1px solid #e4e7ec;border-radius:8px;padding:12px;margin-top:8px;overflow:auto"><code>${escapeHtml(detail)}</code></pre></details>`;
  }

  const contextRows = context.map(([label, value]) =>
    `<tr><td style="padding:5px 12px 5px 0;font-weight:700;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:5px 0">${escapeHtml(value)}</td></tr>`
  ).join("");
  const contextCard = card("Contexto da execução", `<table style="border-collapse:collapse;width:100%"><tbody>${contextRows}</tbody></table>`, "#d0d5dd", "#fcfcfd");

  const links = [
    samId ? `<a href="${jiraUrl}">TC oficial ${escapeHtml(samId)}</a>` : null,
    defect ? `<a href="${escapeHtml(defect.url || "#")}">Defeito ${escapeHtml(defect.jira)}</a>` : null,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const linksCard = card(
    "Links e evidências",
    `${links || "Links disponíveis na seção Links do Allure."}<br><span>Screenshot, vídeo, request/response curado e Playwright Trace permanecem anexados quando capturados.</span>`,
    "#d0d5dd",
    "#fcfcfd"
  );

  return `<div>${header}${summary}${expectedCard}${observedCard}${special}${contextCard}${linksCard}</div>`;
}

function observededOrObserved(value) {
  return value || "No business observation was recorded.";
}

function normalizePresentation(result, defect) {
  const original = String(result.description || "");
  const samId = samIdOf(result);
  const status = businessStatus(result);
  const objective = descriptionField(original, ["Objective", "Validation goal", "Validation Goal", "What was validated"])
    || `Validate the official ${samId || "QST"} business scenario and preserve auditable execution evidence.`;
  const expected = descriptionField(original, ["Expected result", "Expected Result", "Expected"])
    || "The official business acceptance criteria are satisfied and the observed storefront state matches the expected behavior.";
  const blocker = descriptionField(original, ["Blocker category", "Blocker Category", "Blocker"]);
  const detail = technicalDetail(result);
  const title = scenarioTitle(result);
  const observed = actualResult(result, defect);
  const context = contextEntries(result);

  const model = { samId, title, status, objective, expected, observed, blocker, detail, context };
  result.descriptionHtml = renderBusinessHtml(result, defect, model);

  // Keep a concise plain-text fallback for consumers that ignore descriptionHtml.
  const fallback = [
    `${samId ? `${samId} · ` : ""}${title}`,
    `Status: ${defect ? `KNOWN DEFECT ${defect.jira} (runtime ${status})` : status}`,
    `Validated: ${objective}`,
    `Expected: ${expected}`,
    `Observed: ${observed}`,
    defect ? `Known defect: ${defect.jira} · ${defect.title || defect.jira}` : null,
    status === "BLOCKED" ? `Prerequisite: ${blocker || humanizeDetail(detail) || "required test prerequisite unavailable"}` : null,
  ].filter(Boolean);
  result.description = fallback.join("\n");
}

function polishFailureStatusDetails(result, defect) {
  if (businessStatus(result) !== "FAIL") return false;
  const detail = technicalDetail(result);
  const readable = humanizeDetail(detail) || "The automated validation did not satisfy the expected business result.";
  const prefix = defect ? `Known Defect ${defect.jira} — ` : "";
  result.statusDetails ||= {};
  result.statusDetails.message = `${prefix}${readable}\n\nSee the business summary first. Raw technical detail remains in the expandable debug section and Playwright Trace.`;
  return true;
}

function hardenKnownDefect(result) {
  const knownDefect = parameterValue(result, "Known Defect");
  const runtimeStatus = businessStatus(result);
  if (!knownDefect || !["BLOCKED", "FAIL"].includes(runtimeStatus)) return false;

  const defectTitle = parameterValue(result, "Known Defect Title");
  const defectSummary = defectTitle ? `${knownDefect} · ${defectTitle}` : knownDefect;
  result.status = "skipped";
  result.stage = "finished";
  result.statusDetails = {
    message: `Known Defect ${defectSummary}. Runtime status: ${runtimeStatus}. This mapped result is non-gating; see the preserved business summary and evidence.`,
    trace: "",
  };

  if (!Array.isArray(result.steps) || result.steps.length === 0) {
    const start = Number(result.start || Date.now());
    const stop = Number(result.stop || start);
    result.steps = [{
      name: `Known Defect · ${knownDefect}`,
      status: "skipped",
      stage: "finished",
      start,
      stop,
      steps: [],
      attachments: [],
      parameters: [],
      statusDetails: {
        message: `${defectSummary} is active for this exact scope. Raw runtime status ${runtimeStatus} remains available in parameters.`,
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
let polishedFailures = 0;

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

  if (polishFailureStatusDetails(result, defect)) polishedFailures += 1;
  if (hardenKnownDefect(result)) hardened += 1;

  const after = JSON.stringify(result).match(/"source"\s*:/g)?.length || 0;
  removed += Math.max(0, before - after);
  files += 1;
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

console.log(`[allure-dedupe] Processed ${files} result file(s); removed ${removed} duplicate/dangling attachment(s); mapped ${mapped} known defect result(s); normalized ${normalized} polished business result(s); polished ${polishedFailures} failed banner(s); hardened ${hardened} mapped known-defect result(s).`);
