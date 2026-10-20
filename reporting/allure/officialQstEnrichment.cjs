const fs = require("node:fs");
const path = require("node:path");
const { sanitize } = require("../evidence/sanitizer");

const JIRA_BASE_URL = "https://jira.secext.samsung.net/browse/";

function normalizeEnvironment(value) {
  const text = String(value || "").toUpperCase();
  if (/S2|STG2|STAGING2|PREQA2/.test(text)) return "S2";
  if (/S1|STG1|STAGING1/.test(text)) return "S1";
  return text || "UNKNOWN";
}

function prettyEnvironment(value) {
  const normalized = normalizeEnvironment(value);
  return normalized === "S2" ? "S2 / STG2" : normalized === "S1" ? "S1 / STG" : normalized;
}

function normalizeStore(value) {
  return String(value || "BASE_STORE").toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function prettyStore(value) {
  return normalizeStore(value) === "BASE_STORE" ? "Base Store" : normalizeStore(value);
}

function prettyStatus(status) {
  const value = String(status || "").toUpperCase();
  if (/BLOCKED|SKIPPED/.test(value)) return "BLOCKED";
  if (/PASS|EXPECTED/.test(value)) return "PASS";
  if (/FAIL|UNEXPECTED|TIMEDOUT|INTERRUPTED/.test(value)) return "FAIL";
  return value || "NOT_RUN";
}

function blockerCategory(text = "") {
  if (/auth|session|login|credential|account/i.test(text)) return "Authentication / session";
  if (/payment|card|bank|pse|addi|rewards|paypal|cash/i.test(text)) return "Payment prerequisite / configuration";
  if (/sku|product|care\+|sc\+|trade|eligible|test data|address|bogo/i.test(text)) return "Test data / prerequisite";
  if (/timeout|backend|server|environment|staging|network|endpoint/i.test(text)) return "Environment / backend";
  return "Application / prerequisite";
}

function inferFeature(entry = {}, title = "") {
  const value = `${entry.feature || ""} ${title}`;
  if (/backoffice|track order|order process|my orders|order confirmation/i.test(value)) return "Order & BackOffice";
  if (/payment|paypal|cash|rewards payment|credit|debit|installment|bank transfer|pse|addi/i.test(value)) return "Payment";
  if (/checkout|contact|address|delivery|billing|shipping|save option/i.test(value)) return "Checkout";
  if (/cart|trade|care\+|sc\+|warranty|bogo|rewards text/i.test(value)) return "Cart & Promotions";
  if (/login|account|profile|auth/i.test(value)) return "Account & Profile";
  if (/facet|filter|product|pdp|bc page/i.test(value)) return "Product & Catalog";
  return "Storefront UI";
}

function inferUserType(entry = {}, title = "") {
  if (entry.backoffice || /backoffice/i.test(title)) return "BackOffice";
  if (entry.registered || /registered|reg user|my account|my orders/i.test(title)) return "Registered";
  if (/rewards user/i.test(title)) return "Rewards-capable account";
  if (/guest/i.test(title)) return "Guest";
  return "Guest / scenario-specific";
}

function inferPaymentMode(title = "") {
  if (/credit.*debit|credit card|debit card/i.test(title)) return "Credit / Debit Card";
  if (/paypal/i.test(title)) return "PayPal";
  if (/pay in cash|cash payment|pago efectivo/i.test(title)) return "Cash Payment";
  if (/direct bank transfer|internet banking|bank transfer/i.test(title)) return "Bank Transfer / Internet Banking";
  if (/installment/i.test(title)) return "Installments";
  if (/rewards/i.test(title) && /payment/i.test(title)) return "Samsung Rewards";
  if (/addi/i.test(title)) return "ADDI";
  if (/pse/i.test(title)) return "PSE";
  return null;
}

function defaultCaseDetails(entry = {}, samId, market) {
  const title = entry.title || samId;
  const feature = inferFeature(entry, title);
  const objective = `Validate ${market} ${prettyStore(entry.store)} official scenario: ${title}.`;
  let expected = `The official ${samId} business result is satisfied and the observed storefront state matches the expected ${feature.toLowerCase()} behavior.`;
  let steps = ["Prepare the controlled staging context", `Execute the ${title} business journey`, "Validate the official expected result", "Preserve runtime evidence"];

  if (feature === "Account & Profile") {
    steps = ["Prepare the required account/session state", `Open the ${title} journey`, "Validate the authenticated/account controls", "Preserve account-state evidence"];
  } else if (feature === "Product & Catalog") {
    steps = ["Open the controlled storefront/catalog context", `Execute ${title}`, "Validate product/catalog behavior", "Preserve product/SKU evidence"];
  } else if (feature === "Cart & Promotions") {
    steps = ["Add the controlled product to cart", `Execute ${title}`, "Validate cart/service/promotion state", "Preserve SKU and cart evidence"];
  } else if (feature === "Checkout") {
    steps = ["Prepare the controlled cart", "Enter checkout", `Execute ${title}`, "Validate checkout state/progression", "Preserve checkout evidence"];
  } else if (feature === "Payment") {
    steps = ["Prepare the required account/cart", "Reach Payment", `Execute ${title}`, "Validate the payment-mode outcome", "Preserve payment/order evidence when submission is authorized"];
    expected = `The required payment method and ${samId} acceptance criteria are satisfied without claiming order creation unless an authorized submit is executed and proven.`;
  } else if (feature === "Order & BackOffice") {
    steps = ["Prepare or reuse the required order context", `Execute ${title}`, "Validate order/reference/status information", "Preserve order or BackOffice evidence"];
  }

  return { objective, expected, steps, feature, userType: inferUserType(entry, title), paymentMode: inferPaymentMode(title) };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function collectEvidenceFiles(root) {
  if (!root || !fs.existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name === "qst-evidence.json") files.push(target);
    }
  };
  visit(root);
  return files;
}

function evidenceId(item = {}) {
  return item.zephyrId || item.samId || String(item.title || "").match(/SAM-\d+/)?.[0] || null;
}

function loadEvidence(root) {
  const byId = new Map();
  for (const file of collectEvidenceFiles(root)) {
    const payload = readJson(file);
    for (const item of payload?.tests || []) {
      const id = evidenceId(item);
      if (!id) continue;
      const previous = byId.get(id) || {};
      byId.set(id, sanitize({ ...previous, ...item }));
    }
  }
  return byId;
}

function readKnownDefects() {
  return readJson(path.resolve("governance/known-defects.json")) || { defects: [] };
}

function activeDefect(registry, market, environment, store, samId) {
  return (registry.defects || []).find((defect) =>
    String(defect.market || "").toUpperCase() === market &&
    normalizeEnvironment(defect.environment) === normalizeEnvironment(environment) &&
    (!defect.store || normalizeStore(defect.store) === normalizeStore(store)) &&
    String(defect.samId || "").toUpperCase() === samId &&
    String(defect.status || "OPEN").toUpperCase() !== "CLOSED"
  ) || null;
}

function upsert(list, name, value) {
  const next = (list || []).filter((item) => item.name !== name);
  if (value !== undefined && value !== null && value !== "") next.push({ name, value: String(value) });
  return next;
}

function addTag(labels, value) {
  if (!value) return labels;
  if (!labels.some((label) => label.name === "tag" && label.value === value)) labels.push({ name: "tag", value });
  return labels;
}

function safeContextUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value).split("?")[0];
  }
}

function dynamicContext({ market, environment, store, samId, entry, details, runtimeTest, evidence, defect, defaults }) {
  const orderCode = evidence.orderCode || evidence.orderId || evidence.orderNumber || evidence.publicOrderCode || null;
  const sku = evidence.sku || evidence.productSku || evidence.bogoSku || evidence.controlledSkuPreserved || defaults?.sku || null;
  const paymentMode = evidence.paymentMode || details.paymentMode || null;
  return sanitize({
    testCase: samId,
    market,
    environment: prettyEnvironment(environment),
    store: prettyStore(store),
    feature: details.feature,
    userType: details.userType,
    sku,
    productUrl: safeContextUrl(evidence.pdpUrl || evidence.bogoPdp || defaults?.pdpUrl || null),
    paymentMode,
    orderId: orderCode,
    paymentOutcome: evidence.outcome || evidence.paymentOutcome || null,
    runtimeStatus: prettyStatus(runtimeTest?.status || evidence.result),
    coverage: entry.coverage || null,
    knownDefect: defect ? { jira: defect.jira, url: defect.url, title: defect.title, status: defect.status } : null,
  });
}

function writeContextAttachment(resultsDir, result, fileName, context, market) {
  const stem = String(result.uuid || fileName).replace(/[^a-zA-Z0-9_-]/g, "");
  const source = `${stem}-${market.toLowerCase()}-test-context.json`;
  fs.writeFileSync(path.join(resultsDir, source), JSON.stringify(context, null, 2));
  result.attachments = (result.attachments || []).filter((item) => item.name !== `${market} Test Context`);
  result.attachments.push({ name: `${market} Test Context`, source, type: "application/json" });
}

function copyReporterAttachments(resultsDir, result, evidence, market) {
  const existing = new Set((result.attachments || []).map((item) => item.name));
  let index = 0;
  for (const attachment of evidence?.attachments || []) {
    if (!attachment?.path || !attachment.name || existing.has(attachment.name) || !fs.existsSync(attachment.path)) continue;
    const extension = path.extname(attachment.path) || ".bin";
    const source = `${String(result.uuid || market).replace(/[^a-zA-Z0-9_-]/g, "")}-${market.toLowerCase()}-evidence-${index++}${extension}`;
    try {
      fs.copyFileSync(attachment.path, path.join(resultsDir, source));
      result.attachments.push({ name: attachment.name, source, type: attachment.contentType || "application/octet-stream" });
      existing.add(attachment.name);
    } catch {}
  }
}

function normalizeBusinessSteps(result, details) {
  const technical = /^(before hooks?|after hooks?|locator|expect\b|wait for|waitfor|page\.|browser\.|context\.|fixture|query count|evaluate|attach|api\b)/i;
  const explicit = (result.steps || []).filter((step) => {
    const name = String(step?.name || "").trim();
    return name && !technical.test(name);
  });
  if (explicit.length) {
    result.steps = explicit;
    return;
  }
  const start = Number(result.start || Date.now());
  const stop = Number(result.stop || start);
  result.steps = details.steps.map((name) => ({
    name,
    status: "skipped",
    stage: "finished",
    start,
    stop,
    steps: [],
    attachments: [],
    parameters: [],
    statusDetails: { message: "Official business journey outline. Measured browser/network actions remain available in Playwright Trace and evidence attachments." },
  }));
}

function description({ samId, market, environment, store, entry, details, runtimeTest, context, defect }) {
  const status = prettyStatus(runtimeTest?.status || context.runtimeStatus);
  const reason = runtimeTest?.blockedReason || runtimeTest?.error || "";
  const lines = [
    `### [${samId}](${JIRA_BASE_URL}${samId}) · ${entry.title}`,
    "",
    `**Objective:** ${details.objective}`,
    `**Expected result:** ${details.expected}`,
    "",
    `**Market:** ${market}`,
    `**Environment:** ${prettyEnvironment(environment)}`,
    `**Store:** ${prettyStore(store)}`,
    `**Feature:** ${details.feature}`,
    `**User type:** ${details.userType}`,
    context.sku ? `**SKU:** ${context.sku}` : null,
    context.paymentMode ? `**Payment:** ${context.paymentMode}` : null,
    context.orderId ? `**Order ID:** ${context.orderId}` : null,
    `**Runtime status:** ${status}`,
    entry.coverage ? `**Automation coverage:** ${String(entry.coverage).toUpperCase()}` : null,
    defect ? `**Known defect:** [${defect.jira}](${defect.url}) · ${defect.title}` : null,
    status === "BLOCKED" && reason ? `**Blocker category:** ${blockerCategory(reason)}` : null,
    reason ? `**Runtime detail:** ${String(reason).split("\n")[0]}` : null,
    "",
    "_Business steps describe the official validation journey. Technical request/response evidence is curated and sanitized; full browser detail remains in Playwright Trace._",
  ].filter(Boolean);
  return lines.join("  \n");
}

function enrichOfficialQst({
  market,
  resultsDir,
  runtimeFile,
  evidenceRoot,
  environment,
  store = "BASE_STORE",
  cases,
  auditedIds,
  detailsById = {},
  defaults = {},
}) {
  market = String(market).toUpperCase();
  resultsDir = path.resolve(resultsDir);
  runtimeFile = path.resolve(runtimeFile);
  evidenceRoot = path.resolve(evidenceRoot || path.join(path.dirname(runtimeFile), "evidence"));
  if (!fs.existsSync(resultsDir)) return { enriched: 0, official: 0 };

  const officialIds = Object.entries(cases)
    .filter(([, entry]) => normalizeStore(entry.store) === normalizeStore(store) && entry.scopeStatus !== "historical-only")
    .map(([id]) => id)
    .sort();
  const audited = [...auditedIds].sort();
  if (JSON.stringify(officialIds) !== JSON.stringify(audited)) {
    const missing = officialIds.filter((id) => !audited.includes(id));
    const extra = audited.filter((id) => !officialIds.includes(id));
    throw new Error(`${market} Allure audit drift. Missing audited IDs: ${missing.join(", ") || "none"}; extra audited IDs: ${extra.join(", ") || "none"}.`);
  }

  const runtime = readJson(runtimeFile) || { tests: [] };
  const runtimeById = new Map((runtime.tests || []).map((item) => [item.samId || item.id || item.officialTc, item]).filter(([id]) => id));
  const evidenceById = loadEvidence(evidenceRoot);
  const registry = readKnownDefects();
  let enriched = 0;

  for (const fileName of fs.readdirSync(resultsDir).filter((name) => name.endsWith("-result.json"))) {
    const file = path.join(resultsDir, fileName);
    const result = readJson(file);
    if (!result) continue;
    const searchable = `${result.name || ""} ${result.fullName || ""}`;
    const samId = searchable.match(/SAM-\d+/)?.[0];
    const entry = samId ? cases[samId] : null;
    if (!samId || !entry || !officialIds.includes(samId)) continue;

    const runtimeTest = runtimeById.get(samId) || {};
    const evidence = evidenceById.get(samId) || {};
    const details = { ...defaultCaseDetails(entry, samId, market), ...(detailsById[samId] || {}) };
    details.feature ||= inferFeature(entry, entry.title);
    details.userType ||= inferUserType(entry, entry.title);
    details.paymentMode ||= inferPaymentMode(entry.title);
    const defect = activeDefect(registry, market, environment, store, samId);
    const context = dynamicContext({ market, environment, store, samId, entry, details, runtimeTest, evidence, defect, defaults });

    result.name = `${samId} · ${entry.title}`;
    result.description = description({ samId, market, environment, store, entry, details, runtimeTest, context, defect });
    result.labels = upsert(result.labels, "epic", "Samsung SMB QST");
    result.labels = upsert(result.labels, "parentSuite", `${market} · ${prettyEnvironment(environment)}`);
    result.labels = upsert(result.labels, "suite", `${prettyStore(store)} · P1/QST`);
    result.labels = upsert(result.labels, "feature", details.feature);
    result.labels = upsert(result.labels, "story", entry.title);
    result.labels = upsert(result.labels, "severity", entry.payment || /payment|order confirmation/i.test(entry.title) ? "critical" : entry.dataDependent ? "normal" : "normal");
    addTag(result.labels, market.toLowerCase());
    addTag(result.labels, normalizeEnvironment(environment).toLowerCase());
    addTag(result.labels, "qst");
    addTag(result.labels, normalizeStore(store).toLowerCase());
    if (defect) addTag(result.labels, "known-defect");

    result.parameters = upsert(result.parameters, "Market", market);
    result.parameters = upsert(result.parameters, "Environment", prettyEnvironment(environment));
    result.parameters = upsert(result.parameters, "Store", prettyStore(store));
    result.parameters = upsert(result.parameters, "User Type", details.userType);
    result.parameters = upsert(result.parameters, "SKU", context.sku);
    result.parameters = upsert(result.parameters, "Payment", context.paymentMode);
    result.parameters = upsert(result.parameters, "Order ID", context.orderId);
    result.parameters = upsert(result.parameters, "Runtime Status", context.runtimeStatus);
    result.parameters = upsert(result.parameters, "Coverage", entry.coverage ? String(entry.coverage).toUpperCase() : null);
    result.parameters = upsert(result.parameters, "Known Defect", defect?.jira || null);

    result.links = (result.links || []).filter((link) => ![samId, defect?.jira].includes(link.name));
    result.links.push({ name: samId, url: `${JIRA_BASE_URL}${samId}`, type: "issue" });
    if (defect?.jira && defect.url) result.links.push({ name: defect.jira, url: defect.url, type: "issue" });

    normalizeBusinessSteps(result, details);
    writeContextAttachment(resultsDir, result, fileName, context, market);
    copyReporterAttachments(resultsDir, result, evidence, market);
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    enriched += 1;
  }

  console.log(`[allure-${market.toLowerCase()}] Enriched ${enriched} result(s); audited ${officialIds.length}/${officialIds.length} official ${prettyStore(store)} P1 TCs.`);
  return { enriched, official: officialIds.length };
}

module.exports = {
  enrichOfficialQst,
  defaultCaseDetails,
  inferFeature,
  inferUserType,
  inferPaymentMode,
  normalizeEnvironment,
  prettyStatus,
  blockerCategory,
};
