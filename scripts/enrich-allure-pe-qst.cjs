const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || path.join(process.env.PE_QST_ARTIFACT_DIR || "test-results/jenkins/pe-qst", "runtime-summary.json"));
const evidenceFile = path.resolve(process.argv[4] || path.join(path.dirname(runtimeFile), "evidence", "qst-evidence.json"));
const plan = require("../governance/pe-qst-reuse-plan.json");
const { getPeQstConfig } = require("../config/markets/pe");
const { sanitize } = require("../reporting/evidence/sanitizer");

if (!fs.existsSync(resultsDir)) process.exit(0);

const runtime = fs.existsSync(runtimeFile) ? JSON.parse(fs.readFileSync(runtimeFile, "utf8")) : { tests: [] };
const runtimeById = new Map((runtime.tests || []).map((item) => [item.samId || item.id, item]).filter(([id]) => id));
const evidence = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, "utf8")) : { tests: [] };
const evidenceById = new Map();
for (const item of evidence.tests || []) {
  const id = item.zephyrId || String(item.title || "").match(/SAM-\d+/)?.[0];
  if (id) evidenceById.set(id, { ...(evidenceById.get(id) || {}), ...item });
}

const targetEnvironment = String(process.env.PE_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const environmentLabel = targetEnvironment === "S2" ? "S2 / STG2" : "S1 / STG";
const config = getPeQstConfig({ ...process.env, PE_QST_ENVIRONMENT: targetEnvironment });
const JIRA_BASE_URL = "https://jira.secext.samsung.net/browse/";

const D = (objective, expected, steps, extra = {}) => ({ objective, expected, steps, ...extra });
const CASE_DETAILS = {
  "SAM-25055": D("Validate PE registered-user login on the storefront home page.", "The authenticated Samsung Account session is recognized and the registered profile controls are available.", ["Restore the PE registered session", "Open the PE storefront home page", "Validate authenticated account state", "Validate registered profile/logout controls"], { userType: "Registered" }),
  "SAM-25056": D("Validate add, edit and delete address lifecycle in My Profile.", "A registered user can create, update and remove a QA address and the changes are reflected correctly.", ["Restore registered session", "Open My Profile address management", "Create QA address", "Edit the created address", "Delete the QA address and validate cleanup"], { userType: "Registered" }),
  "SAM-25057": D("Validate the registered-user My Orders page.", "My Orders opens for the authenticated account and exposes existing order information when available.", ["Restore registered session", "Open My Orders", "Validate orders page", "Read visible order references/status information"], { userType: "Registered" }),
  "SAM-25061": D("Validate a configured PE product can be added from PDP to cart.", "The configured SKU is added successfully and is visible in the PE cart.", ["Open configured PE PDP", "Add product to cart", "Capture add-to-cart request/response", "Open/validate cart", "Validate configured SKU is present"], { userType: "Guest", network: true }),
  "SAM-25062": D("Validate PE cart page presentation for the controlled product.", "Product, price, summary, available services and footer are rendered without blocking UI issues.", ["Add configured product", "Validate SKU and cart item presentation", "Validate subtotal and total", "Inspect available services", "Validate cart footer"], { userType: "Guest", network: true }),
  "SAM-25064": D("Validate the order summary on the PE cart page.", "The cart order summary exposes the expected subtotal and total values for the controlled SKU.", ["Add configured product", "Open cart", "Validate subtotal", "Validate total", "Preserve cart evidence"], { userType: "Guest", network: true }),
  "SAM-25065": D("Validate Samsung Rewards surfaces for an eligible Rewards user journey.", "Rewards information is visible in the applicable cart/checkout surfaces for the current environment and account capability.", ["Add configured product", "Validate Rewards surface in cart", "Continue to checkout", "Validate Rewards surface in checkout"], { userType: "Rewards-capable account", network: true }),
  "SAM-25068": D("Validate an active PE BOGO promotion in cart.", "The eligible BOGO source SKU and promotional gift entries are displayed in cart.", ["Open BOGO-eligible PDP", "Add BOGO source SKU", "Validate source SKU in cart", "Validate BOGO Gift labels", "Record promotion test data"], { userType: "Guest", network: true }),
  "SAM-25074": D("Validate Samsung Care+ availability for an eligible PE product.", "SC+ is exposed in cart when the configured SKU is eligible; otherwise the TC is explicitly blocked as missing test data.", ["Add configured product", "Inspect cart services", "Locate Samsung Care+", "Validate SC+ surface or explicit test-data blocker"], { userType: "Guest", network: true }),
  "SAM-25075": D("Validate the PE Trade-in journey from cart.", "Trade-in can be completed and the resulting valuation/summary is reflected in cart.", ["Add configured product", "Open Trade-in journey", "Complete device valuation flow", "Validate Trade-in added", "Validate Trade-in summary amount"], { userType: "Guest", network: true }),
  "SAM-25076": D("Validate the PE Trade-up / Plan Canje surface.", "The Trade-up service is available for the controlled SKU and its journey can be opened without losing the cart product.", ["Add configured product", "Validate cart/product", "Locate Trade-up service", "Open Trade-up journey", "Return to cart and validate SKU remains"], { userType: "Guest", network: true }),
  "SAM-25079": D("Validate PE desktop storefront UI baseline.", "Header and footer are rendered correctly in desktop viewport without blocking visual distortion.", ["Open PE storefront in desktop viewport", "Validate header", "Validate footer", "Preserve screenshot/trace evidence"], { userType: "Guest" }),
  "SAM-25080": D("Validate login entry from checkout.", "The checkout login action routes to the legitimate Samsung Account authentication flow.", ["Add configured product", "Continue to checkout", "Select registered login", "Validate Samsung Account destination"], { userType: "Guest → Registered", network: true }),
  "SAM-25081": D("Validate the checkout CTA from cart.", "The cart checkout action is enabled and navigation reaches the PE checkout journey.", ["Add configured product", "Validate checkout CTA", "Continue to checkout", "Capture checkout request/response", "Validate checkout entry"], { userType: "Guest", network: true }),
  "SAM-25084": D("Validate adding/editing a saved or new address during registered checkout.", "Address data can be created or edited and the updated values are reflected in registered checkout.", ["Restore registered session", "Enter registered checkout", "Create or edit checkout address", "Validate updated address values", "Preserve address-state evidence"], { userType: "Registered", network: true }),
  "SAM-25085": D("Validate selecting a saved address in registered checkout.", "A saved address can be selected and remains the active checkout address.", ["Restore registered session", "Enter Delivery", "Select saved address", "Validate selected address state"], { userType: "Registered", network: true }),
  "SAM-25086": D("Validate the save-address option for a registered user.", "The registered checkout exposes save-address capability and the intended address persistence behavior is respected.", ["Restore registered session", "Enter new delivery address", "Validate save-address option", "Exercise controlled save behavior", "Validate resulting address state"], { userType: "Registered", network: true }),
  "SAM-25087": D("Validate checkout with a new address.", "The user can populate a new PE address and progress through the applicable checkout flow.", ["Enter checkout", "Select new address", "Populate address", "Validate address acceptance", "Validate checkout progression"], { userType: "Registered", network: true }),
  "SAM-25088": D("Validate save-address option is not available to guest users.", "Guest checkout does not expose the registered-user save-address capability.", ["Add configured product", "Continue as guest", "Reach Delivery", "Inspect save-address controls", "Validate save option is absent"], { userType: "Guest", network: true }),
  "SAM-25089": D("Validate different shipping and billing addresses in guest checkout.", "Distinct shipping and billing address data can be entered and remain independently represented.", ["Reach guest Delivery", "Fill shipping address", "Enter different billing address", "Validate shipping/billing values remain distinct"], { userType: "Guest", network: true }),
  "SAM-25090": D("Validate PE home delivery selection.", "The applicable home-delivery option can be selected and is reflected in the order summary.", ["Reach guest Delivery", "Fill delivery address", "Select province home delivery", "Capture delivery request/response", "Validate selected delivery in summary"], { userType: "Guest", network: true }),
  "SAM-25094": D("Validate the Back to Top control on the PE cart.", "The Back to Top control is rendered after scrolling and is available to return the cart view upward.", ["Add configured product", "Open cart", "Scroll to bottom", "Locate Back to Top", "Validate control is visible"], { userType: "Guest", network: true }),
  "SAM-25095": D("Validate registered-user credit/debit-card payment readiness.", "The registered checkout reaches payment and exposes the credit/debit-card method and card form correctly.", ["Restore registered session", "Reach registered payment", "Select Credit/Debit Card", "Validate card payment surface", "Preserve payment evidence"], { userType: "Registered", paymentMode: "Credit / Debit Card", network: true }),
  "SAM-25096": D("Validate registered-user Pago Efectivo payment readiness.", "The registered checkout reaches payment and exposes Pago Efectivo correctly.", ["Restore registered session", "Reach registered payment", "Select Pago Efectivo", "Validate payment surface", "Preserve payment evidence"], { userType: "Registered", paymentMode: "Pago Efectivo", network: true }),
  "SAM-25097": D("Validate Internet Banking payment readiness.", "Guest checkout reaches payment and exposes Banca por Internet correctly.", ["Reach guest payment", "Capture checkout/payment requests", "Select Banca por Internet", "Validate Internet Banking payment surface"], { userType: "Guest", paymentMode: "Banca por Internet", network: true }),
  "SAM-25099": D("Validate PE order confirmation after an authorized payment submission.", "A valid PE order code is created and the Samsung order-confirmation page displays the new order.", ["Prepare single-item checkout", "Reach payment", "Submit the authorized payment once", "Capture order code and payment outcome", "Validate Samsung order confirmation"], { userType: "Guest", paymentMode: "Environment-specific", network: true, createsOrder: true }),
  "SAM-25103": D("Validate PE BackOffice order and product search/read access.", "BackOffice authentication succeeds and the required order/product information can be located and read.", ["Authenticate to target BackOffice", "Open Orders", "Search/read order", "Search/read product", "Validate returned BackOffice data"], { userType: "BackOffice" }),
  "SAM-25104": D("Validate the PE order process in BackOffice.", "The reference order can be opened and its process/status information satisfies the official order-process checkpoint.", ["Authenticate to target BackOffice", "Locate the PE order", "Open order details", "Read process/status", "Validate expected order-process state"], { userType: "BackOffice" }),
};

function upsert(list, key, value) {
  const next = (list || []).filter((item) => item.name !== key);
  if (value !== undefined && value !== null && value !== "") next.push({ name: key, value: String(value) });
  return next;
}

function feature(entry) {
  const value = String(entry.feature || "Storefront");
  if (/order|backoffice/i.test(value)) return "Order & BackOffice";
  if (/payment/i.test(value)) return "Payment";
  if (/checkout/i.test(value)) return "Checkout";
  if (/cart/i.test(value)) return "Cart & Promotions";
  if (/auth/i.test(value)) return "Account & Profile";
  return "Storefront UI";
}

function prettyStatus(status) {
  if (/blocked|skipped/i.test(String(status || ""))) return "BLOCKED";
  if (/pass/i.test(String(status || ""))) return "PASS";
  if (/fail|timedout|interrupted/i.test(String(status || ""))) return "FAIL";
  return String(status || "NOT_RUN").toUpperCase();
}

function blockerCategory(text = "") {
  if (/auth|session|login|credential/i.test(text)) return "Authentication / session";
  if (/bogo|care\+|sc\+|sku|product|eligible|test data/i.test(text)) return "Test data / prerequisite";
  if (/payment|rewards|card|bank/i.test(text)) return "Payment prerequisite / configuration";
  if (/environment|backend|server|network|timeout/i.test(text)) return "Environment / backend";
  return "Application / prerequisite";
}

function contextFor(samId, details, runtimeTest, businessEvidence) {
  const dynamic = sanitize({
    sku: businessEvidence?.bogoSku || businessEvidence?.controlledSkuPreserved || config?.sku || null,
    pdpUrl: businessEvidence?.bogoPdp || config?.pdpUrl?.href || null,
    userType: details.userType || null,
    paymentMode: businessEvidence?.paymentMode || details.paymentMode || null,
    orderCode: businessEvidence?.orderCode || null,
    paymentOutcome: businessEvidence?.outcome || null,
    promotion: businessEvidence?.promotionLabel || null,
    market: "PE",
    environment: environmentLabel,
    store: "BASE_STORE",
    testCase: samId,
    runtimeStatus: prettyStatus(runtimeTest?.status),
  });
  return dynamic;
}

function addContextAttachment(result, fileName, context) {
  const source = `${String(result.uuid || fileName).replace(/[^a-zA-Z0-9_-]/g, "")}-pe-context.json`;
  fs.writeFileSync(path.join(resultsDir, source), JSON.stringify(context, null, 2));
  result.attachments = (result.attachments || []).filter((item) => item.name !== "PE Test Context");
  result.attachments.push({ name: "PE Test Context", source, type: "application/json" });
}

function normalizeBusinessSteps(result, details) {
  const technical = /^(before hooks?|after hooks?|locator|expect\b|wait for|page\.|browser\.|context\.|fixture|query count|evaluate)/i;
  const explicit = (result.steps || []).filter((step) => String(step?.name || "").trim() && !technical.test(String(step.name)));
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
    statusDetails: { message: "Official PE business journey outline; measured technical actions remain in Playwright trace and request/response attachments." },
  }));
}

let enriched = 0;
for (const fileName of fs.readdirSync(resultsDir).filter((name) => name.endsWith("-result.json"))) {
  const file = path.join(resultsDir, fileName);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const searchable = `${result.name || ""} ${result.fullName || ""}`;
  const samId = searchable.match(/SAM-\d+/)?.[0];
  const entry = samId ? plan.cases[samId] : null;
  if (!samId || !entry || entry.store !== "BS") continue;

  const details = CASE_DETAILS[samId] || D(`Validate the official PE scenario: ${entry.title}.`, `The official ${samId} expected result is satisfied.`, ["Prepare PE test context", "Execute official business scenario", "Validate expected result"]);
  const runtimeTest = runtimeById.get(samId);
  const businessEvidence = evidenceById.get(samId) || {};
  const context = contextFor(samId, details, runtimeTest, businessEvidence);
  const status = prettyStatus(runtimeTest?.status || result.status);
  const reason = runtimeTest?.blockedReason || runtimeTest?.error || "";

  result.name = `${samId} · ${entry.title}`;
  result.labels = upsert(result.labels, "epic", "Samsung SMB QST Automation");
  result.labels = upsert(result.labels, "feature", feature(entry));
  result.labels = upsert(result.labels, "story", entry.title);
  result.labels = upsert(result.labels, "tag", "PE");
  result.labels = upsert(result.labels, "tag", "Official P1");
  result.parameters = upsert(result.parameters, "Market", "PE");
  result.parameters = upsert(result.parameters, "Environment", environmentLabel);
  result.parameters = upsert(result.parameters, "Store", "Base Store");
  result.parameters = upsert(result.parameters, "SKU", context.sku);
  result.parameters = upsert(result.parameters, "User Type", context.userType);
  result.parameters = upsert(result.parameters, "Payment Method", context.paymentMode);
  result.parameters = upsert(result.parameters, "Order ID", context.orderCode);

  const jira = `${JIRA_BASE_URL}${samId}`;
  result.links = (result.links || []).filter((link) => link.name !== samId);
  result.links.push({ name: samId, url: jira, type: "issue" });

  result.description = [
    `### [${samId}](${jira}) · ${entry.title}`,
    "",
    `**Objective:** ${details.objective}`,
    `**Expected result:** ${details.expected}`,
    "",
    `**Market:** PE  `,
    `**Environment:** ${environmentLabel}  `,
    `**Store:** Base Store  `,
    `**Runtime status:** ${status}  `,
    context.sku ? `**SKU:** ${context.sku}  ` : null,
    context.userType ? `**User type:** ${context.userType}  ` : null,
    context.paymentMode ? `**Payment:** ${context.paymentMode}  ` : null,
    context.orderCode ? `**Order ID:** ${context.orderCode}  ` : null,
    status === "BLOCKED" && reason ? `**Blocker category:** ${blockerCategory(reason)}  ` : null,
    reason ? `**Runtime detail:** ${String(reason).split("\n")[0]}  ` : null,
    "",
    details.network ? "_Business request/response attachments are captured around cart/checkout mutations and sanitized before publication. Playwright Trace remains the full technical diagnostic source._" : "_Playwright Trace and screenshots remain available as technical evidence when produced by the run._",
  ].filter(Boolean).join("\n");

  normalizeBusinessSteps(result, details);
  addContextAttachment(result, fileName, context);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  enriched += 1;
}

console.log(`[pe-allure] Enriched ${enriched} official PE Base Store Allure result(s).`);
module.exports = { CASE_DETAILS };
