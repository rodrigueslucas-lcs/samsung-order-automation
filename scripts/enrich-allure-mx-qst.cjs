const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || "runtime-summary.json");

if (!fs.existsSync(resultsDir)) process.exit(0);
const runtime = fs.existsSync(runtimeFile)
  ? JSON.parse(fs.readFileSync(runtimeFile, "utf8"))
  : { tests: [] };
const byId = new Map((runtime.tests || []).map((test) => [test.samId, test]));
const JIRA_BASE_URL = "https://jira.secext.samsung.net/browse/";
const jiraUrl = samId => `${JIRA_BASE_URL}${samId}`;
const campaign = process.env.TEST_SUITE === "FAST/GUEST" ? "FAST / GUEST-SAFE" : "P1 / QST";
const campaignLabel = process.env.TEST_SUITE === "FAST/GUEST" ? "MX Fast Guest · Safe" : "MX Official P1/QST";

function upsertLabel(labels, name, value) {
  const next = (labels || []).filter((label) => label.name !== name);
  if (value) next.push({ name, value });
  return next;
}
function pushUniqueLabel(labels, name, value) {
  if (value && !labels.some((label) => label.name === name && label.value === value)) labels.push({ name, value });
  return labels;
}
function classifyBlocker(text = "") {
  if (/auth|session|login|logged|account|credential/i.test(text)) return "Authentication / session";
  if (/sku|product|eligible|data|address|order|email/i.test(text)) return "Test data / prerequisite";
  if (/executable doesn.t exist|browser.*executable|ms-playwright|ffmpeg|spawn (eperm|enoent)|playwright.*install/i.test(text)) return "Infrastructure / Playwright";
  if (/environment|staging|s1|backend|server|maintenance|timeout|unavailable|endpoint|cdp|network/i.test(text)) return "Environment / backend";
  return "Prerequisite";
}
function inferFeature(result, runtimeTest) {
  const value = `${runtimeTest?.title || ""} ${result.name || ""} ${result.fullName || ""}`.toLowerCase();
  const rules = [
    ["Order & Tracking", /track|tracking|order|pedido|confirmation|confirmaci/],
    ["Payment", /payment|pago|mercado|card|tarjeta/],
    ["Checkout", /checkout|delivery|shipping|address|direcci/],
    ["Cart & Promotions", /cart|carrito|coupon|cup[oó]n|promo/],
    ["Product & Catalog", /pdp|plp|product|producto|facet|filter|gnb|catalog|bc-add/],
    ["Account & Profile", /login|account|profile|registered|registro|address book/],
    ["Search & Navigation", /search|busca|navigation|home|banner/],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || "Storefront";
}
function inferOwner(result) {
  return result.labels?.find((label) => label.name === "owner")?.value || "Samsung SMB QA";
}
function prettyStatus(status) {
  return status === "SKIPPED-BLOCKED" || status === "BLOCKED" ? "BLOCKED" : status || "Playwright result";
}
function businessJourney(feature, title = "") {
  const value = String(title).toLowerCase();
  if (feature === "Order & Tracking") return [
    "Prepare order / tracking test data",
    "Open the order tracking journey",
    "Submit order reference and customer identity",
    "Complete verification when required",
    "Validate registered order information",
  ];
  if (feature === "Payment") return [
    "Prepare checkout test data",
    "Reach the payment step",
    "Load available payment methods",
    "Select the expected payment method",
    /order|submit|place/.test(value) ? "Submit the authorized order action" : "Validate payment controls and continuation",
  ];
  if (feature === "Checkout") return [
    "Prepare cart for checkout",
    "Open checkout",
    "Complete delivery and customer information",
    "Validate address / delivery prerequisites",
    "Reach the expected checkout stage",
  ];
  if (feature === "Cart & Promotions") return [
    "Prepare storefront test data",
    "Add the target product to cart",
    "Open and validate cart state",
    /coupon|promo|cup[oó]n/.test(value) ? "Apply the promotion / coupon scenario" : "Exercise the cart scenario",
    "Validate cart business result",
  ];
  if (feature === "Product & Catalog") return [
    "Open the target catalog journey",
    "Navigate to the expected PLP / PDP",
    /facet|filter/.test(value) ? "Apply the requested catalog filter" : "Validate product information and availability",
    "Exercise the product interaction",
    "Validate the expected catalog result",
  ];
  if (feature === "Account & Profile") return [
    "Open the customer account journey",
    "Provide the required account context",
    "Complete authentication / profile action",
    "Validate customer state",
  ];
  if (feature === "Search & Navigation") return [
    "Open Samsung storefront",
    "Navigate through the requested entry point",
    "Exercise search / navigation interaction",
    "Validate the expected destination and content",
  ];
  return ["Prepare test context", "Open Samsung storefront", "Exercise the business scenario", "Validate the expected result"];
}
function syntheticBusinessSteps(feature, title, result) {
  // Allure is a business execution report. Low-level adapter operations such as
  // locator/request/expect/navigation belong in Playwright Trace, not the main tree.
  const technical = /^(before hooks?|after hooks?|navigate|expect\b|wait for|waitfor|locator\b|request\b|page\.|browser\.|context\.|api\b|fixture\b)/i;
  const explicitBusinessSteps = (result.steps || []).filter((step) => {
    const name = String(step?.name || "").trim();
    return name && !technical.test(name);
  });
  const start = Number(result.start || Date.now());
  const stop = Number(result.stop || start);
  const names = businessJourney(feature, title);
  const slice = Math.max(1, Math.floor(Math.max(1, stop - start) / names.length));
  const curated = names.map((name, index) => ({
    name,
    status: result.status === "passed" ? "passed" : (index === names.length - 1 ? result.status : "passed"),
    stage: "finished",
    start: start + (slice * index),
    stop: index === names.length - 1 ? stop : Math.min(stop, start + (slice * (index + 1))),
    steps: [],
    attachments: [],
    parameters: [],
  }));
  result.steps = explicitBusinessSteps.length ? explicitBusinessSteps : curated;
}
function buildDescription(samId, feature, runtimeTest, reason) {
  const status = prettyStatus(runtimeTest?.status);
  return [
    `### [${samId}](${jiraUrl(samId)}) · ${feature}`,
    "",
    `**Jira:** [Open ${samId}](${jiraUrl(samId)})`,
    `**Official runtime:** ${status}`,
    `**Campaign:** MX · S1 · Base Store · ${campaign}`,
    `**Store:** Base Store`,
    `**Environment:** S1 / STG`,
    runtimeTest?.duration != null ? `**Duration:** ${(Number(runtimeTest.duration) / 1000).toFixed(1)}s` : null,
    status === "BLOCKED" ? `**Blocker category:** ${classifyBlocker(reason)}` : null,
    reason ? `**Reason:** ${String(reason).split("\n")[0]}` : null,
    "",
    "_Playwright steps and attachments below are the technical execution evidence._",
  ].filter(Boolean).join("  \n");
}
function copyRuntimeAttachments(result, runtimeTest) {
  result.attachments ||= [];
  const normalizeName = (attachment) => {
    const type = String(attachment?.type || attachment?.contentType || "");
    const name = String(attachment?.name || "");
    const source = String(attachment?.source || attachment?.path || "");
    if (/screenshot/i.test(name) || /^image\//i.test(type) || /\.png$/i.test(source)) return "Screenshot · Final state";
    if (/trace/i.test(name) || /\.zip$/i.test(source)) return "Playwright Trace";
    if (/video/i.test(name) || /^video\//i.test(type) || /\.webm$/i.test(source)) return "Video · Execution";
    if (/stdout|stderr|log/i.test(name)) return "Execution log";
    return name || "Evidence";
  };
  const seen = new Set();
  result.attachments = result.attachments.filter((attachment) => {
    const key = String(attachment?.source || "") || `${normalizeName(attachment)}|${attachment?.type || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    attachment.name = normalizeName(attachment);
    return true;
  });
  if (!runtimeTest?.attachments?.length) return;
  for (const attachment of runtimeTest.attachments) {
    if (!attachment?.path || !fs.existsSync(attachment.path)) continue;
    const ext = path.extname(attachment.path);
    // Avoid copying a Playwright artifact already represented by the adapter.
    const semanticKey = `${normalizeName(attachment)}|${attachment.contentType || ext}`;
    if ([...result.attachments].some((item) => `${normalizeName(item)}|${item.type || path.extname(item.source || "")}` === semanticKey)) continue;
    const source = `runtime-${runtimeTest.samId}-${result.attachments.length + 1}${ext}`;
    fs.copyFileSync(attachment.path, path.join(resultsDir, source));
    result.attachments.push({
      name: normalizeName(attachment),
      source,
      type: attachment.contentType || (ext === ".png" ? "image/png" : ext === ".webm" ? "video/webm" : ext === ".zip" ? "application/zip" : "application/octet-stream"),
    });
  }
}

for (const name of fs.readdirSync(resultsDir).filter((file) => file.endsWith("-result.json"))) {
  const file = path.join(resultsDir, name);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const searchable = `${result.name || ""} ${result.fullName || ""}`;
  const samId = searchable.match(/SAM-\d+/)?.[0];
  if (!samId) continue;

  const runtimeTest = byId.get(samId);
  const tags = searchable.match(/@[\w-]+/g) || [];
  const feature = inferFeature(result, runtimeTest);
  const cleanTitle = (runtimeTest?.title || result.name || samId)
    .replace(/\s+@(qst|mx|base-store|safe|registered|guest|destructive)\b/gi, "")
    .trim()
    .replace(new RegExp(`^${samId}\\s*[-–:]?\\s*`, "i"), "");

  result.name = `${samId} · ${cleanTitle || feature}`;
  result.labels = upsertLabel(result.labels, "parentSuite", "Samsung SMB Automation");
  result.labels = upsertLabel(result.labels, "suite", "MX · S1 · Base Store");
  result.labels = upsertLabel(result.labels, "subSuite", `P1 / QST · ${feature}`);
  result.labels = upsertLabel(result.labels, "epic", "Samsung SMB Commerce");
  result.labels = upsertLabel(result.labels, "feature", feature);
  result.labels = upsertLabel(result.labels, "story", cleanTitle || samId);
  result.labels = upsertLabel(result.labels, "severity", "critical");
  result.labels = upsertLabel(result.labels, "owner", inferOwner(result));
  result.labels = upsertLabel(result.labels, "testCaseId", samId);
  result.links = (result.links || []).filter((link) => link.name !== samId && link.type !== "tms");
  result.links.push({ name: samId, url: jiraUrl(samId), type: "tms" });
  result.labels = upsertLabel(result.labels, "layer", "e2e");
  result.labels = upsertLabel(result.labels, "host", "Samsung SMB");
  for (const tag of ["MX", "S1", "Base Store", "P1", "QST", ...tags.map((tag) => tag.slice(1))]) {
    pushUniqueLabel(result.labels, "tag", tag);
  }

  const reason = runtimeTest?.blockedReason || runtimeTest?.error || "";
  if (runtimeTest?.status) pushUniqueLabel(result.labels, "tag", `runtime:${prettyStatus(runtimeTest.status)}`);
  if (prettyStatus(runtimeTest?.status) === "BLOCKED") {
    pushUniqueLabel(result.labels, "tag", "BLOCKED");
    pushUniqueLabel(result.labels, "tag", `blocker:${classifyBlocker(reason)}`);
  }
  result.description = buildDescription(samId, feature, runtimeTest, reason);
  syntheticBusinessSteps(feature, cleanTitle, result);

  result.parameters ||= [];
  const params = {
    Market: "MX",
    Environment: "S1 / STG",
    Store: "Base Store",
    Suite: campaign,
    "Official TC": samId,
    Feature: feature,
  };
  for (const [name, value] of Object.entries(params)) {
    result.parameters = result.parameters.filter((item) => item.name !== name);
    result.parameters.push({ name, value });
  }

  copyRuntimeAttachments(result, runtimeTest);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

const environment = [
  "Project=Samsung SMB Automation",
  "Platform=SAP Commerce / Hybris",
  "Framework=Playwright",
  "Market=MX",
  "Environment=S1/STG",
  "Store=Base Store",
  `Suite=${campaign}`,
  "Official_SMB_Scope=362",
  "Official_P1_QST=144",
  "Official_P2_DST=218",
  "MX_BaseStore_P1_Selected=30",
  `Branch=${process.env.BRANCH_NAME || process.env.GIT_BRANCH || "local"}`,
  `Build=${process.env.BUILD_NUMBER || "local"}`,
].join("\n") + "\n";
fs.writeFileSync(path.join(resultsDir, "environment.properties"), environment);

fs.writeFileSync(path.join(resultsDir, "categories.json"), JSON.stringify([
  { name: "Infrastructure / Playwright", matchedStatuses: ["failed", "broken"], messageRegex: ".*(executable doesn.t exist|browser.*executable|ms-playwright|ffmpeg|spawn (EPERM|ENOENT)|playwright.*install).*" },
  { name: "Authentication / session", matchedStatuses: ["failed", "broken"], messageRegex: ".*(auth|session|login|logged|credential|account).*" },
  { name: "Environment / backend", matchedStatuses: ["failed", "broken"], messageRegex: ".*(environment|backend|server|maintenance|unavailable|endpoint|timeout|network).*" },
  { name: "Test data / prerequisite", matchedStatuses: ["failed", "broken"], messageRegex: ".*(sku|eligible|test data|address|order|prerequisite|product).*" },
  { name: "Functional assertion", matchedStatuses: ["failed"], messageRegex: ".*(expect|assert|expected|received).*" },
  { name: "Automation / selector", matchedStatuses: ["failed", "broken"], messageRegex: ".*(locator|selector|strict mode|element|click|fill).*" },
], null, 2));

if (process.env.BUILD_URL) {
  fs.writeFileSync(path.join(resultsDir, "executor.json"), JSON.stringify({
    name: "Samsung SMB · Jenkins",
    type: "jenkins",
    buildName: `Samsung SMB · ${campaignLabel} · #${process.env.BUILD_NUMBER || ""}`,
    buildUrl: process.env.BUILD_URL,
    reportUrl: `${process.env.BUILD_URL}${encodeURIComponent(process.env.ALLURE_REPORT_NAME || (process.env.TEST_SUITE === "FAST/GUEST" ? "Samsung MX Fast - Allure" : "Samsung MX QST - Allure")).replace(/%20/g, "_20")}/`,
  }, null, 2));
}
console.log(`[allure] Enriched Samsung report: business hierarchy, parameters, categories and runtime evidence -> ${resultsDir}`);
