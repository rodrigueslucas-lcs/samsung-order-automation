const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || path.join(process.env.CO_QST_ARTIFACT_DIR || "test-results/jenkins/co-qst", "runtime-summary.json"));
const plan = require("../governance/co-qst-plan.json");

if (!fs.existsSync(resultsDir)) process.exit(0);

const runtime = fs.existsSync(runtimeFile)
  ? JSON.parse(fs.readFileSync(runtimeFile, "utf8"))
  : { tests: [] };
const runtimeTests = runtime.tests || [];
const byId = new Map(runtimeTests.map((test) => [test.samId || test.id, test]).filter(([id]) => id));
const targetEnvironment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const environmentLabel = targetEnvironment === "S2" ? "S2 / STG2" : "S1 / STG";
const JIRA_BASE_URL = "https://jira.secext.samsung.net/browse/";

const CASE_DETAILS = {
  "SAM-24806": { objective: "Validate the Colombia storefront desktop UI is rendered correctly without broken visual elements.", expected: "Desktop UI renders correctly, key images are available and the storefront layout is usable.", steps: ["Open the CO Base Store home page in desktop viewport", "Validate header, main content and footer are rendered", "Validate storefront images are present", "Confirm the page has no blocking visual distortion"] },
  "SAM-24873": { objective: "Validate a registered user is recognized from the CO home page.", expected: "The authenticated account is active and the profile menu exposes the logout action.", steps: ["Restore the registered CO session", "Open the CO Base Store home page", "Open My Profile", "Validate the authenticated logout control is available"] },
  "SAM-24874": { objective: "Validate the registered-user My Account menu in CO.", expected: "The expected account options are visible for the authenticated user.", steps: ["Restore the registered CO session", "Open My Profile", "Validate My Page / My Orders / Wishlist options", "Validate Logout is available"] },
  "SAM-24875": { objective: "Validate the CO global navigation menu and storefront navigation entry points.", expected: "The GNB is displayed and exposes usable storefront navigation links.", steps: ["Open the CO Base Store home page", "Validate the global header is visible", "Validate navigation links are rendered", "Confirm the GNB is interactive"] },
  "SAM-24879": { objective: "Validate PLP facet/filter availability in CO.", expected: "The product listing exposes filtering controls that can be used to refine products.", steps: ["Open the CO Base Store home page", "Navigate to a product listing category", "Locate the facet/filter controls", "Validate the filtering UI is available"] },
  "SAM-24880": { objective: "Validate a product can be added from the BC/PDP journey in CO.", expected: "The selected product is added successfully and the cart quantity increases.", steps: ["Open a CO buying-category page", "Open a purchasable product PDP", "Capture the cart quantity before the action", "Add the product to cart", "Validate the cart quantity increased"] },
  "SAM-24882": { objective: "Validate the CO cart page presentation.", expected: "The cart shows the product, price, summary and required cart sections correctly.", steps: ["Add the configured CO product to cart", "Open the cart page", "Validate product presentation and price", "Validate order summary", "Validate available services and footer"] },
  "SAM-24883": { objective: "Validate cart quantity management in CO.", expected: "The user can increase/decrease quantity and the cart updates consistently.", steps: ["Add the configured product to cart", "Open the cart page", "Exercise quantity change controls", "Validate the cart reflects the updated quantity"] },
  "SAM-24886": { objective: "Validate Samsung Rewards messaging for a guest user.", expected: "Rewards-related text is visible in the guest cart journey.", steps: ["Add a product to cart as guest", "Open the cart page", "Locate Samsung Rewards messaging", "Validate Rewards text is displayed"] },
  "SAM-24892": { objective: "Validate Samsung Care+ can be added from an eligible CO product journey.", expected: "Care+ can be selected for an eligible product and is reflected in cart.", steps: ["Open an eligible CO product", "Locate Samsung Care+", "Add Care+ with the product", "Open cart", "Validate Care+ is reflected in cart"] },
  "SAM-24893": { objective: "Validate the trade-up / exchange service in the CO cart.", expected: "The trade-up service is available and can be associated with the cart product when eligible.", steps: ["Add an eligible product to cart", "Open cart", "Locate trade-up / exchange service", "Exercise the trade-up control", "Validate the service state in cart"] },
  "SAM-24896": { objective: "Validate cart isolation when switching registered CO accounts.", expected: "After logout/account switch, cart state follows the expected account-isolation behavior and does not leak the first account state.", steps: ["Restore the dedicated second registered account", "Add the configured product and capture cart value", "Logout from the registered account", "Validate the signed-out cart state", "Validate the expected cart value/isolation behavior"] },
  "SAM-24898": { objective: "Validate the checkout action from the CO cart.", expected: "The checkout button is usable and navigates the user into checkout.", steps: ["Add the configured product to cart", "Open cart", "Validate the checkout action is enabled", "Continue to checkout", "Validate checkout is reached"] },
  "SAM-24899": { objective: "Validate the order summary on CO checkout.", expected: "Checkout displays the order summary and total information.", steps: ["Add product to cart", "Continue as guest to checkout", "Open the checkout journey", "Validate order summary", "Validate total information"] },
  "SAM-24900": { objective: "Validate the mandatory Contact Details section in CO checkout.", expected: "Required customer/contact fields accept valid data and allow progression to delivery.", steps: ["Add product and start guest checkout", "Populate the mandatory contact fields", "Select the required identification data", "Submit Contact Details", "Validate Delivery step is reached"] },
  "SAM-24901": { objective: "Validate adding and editing a saved/new address during registered CO checkout.", expected: "A registered user can create/update checkout addresses and the changed values are reflected correctly.", steps: ["Restore registered CO session and enter checkout", "Create new shipping and billing address data", "Save the addresses and continue to payment", "Edit the saved checkout address", "Validate the updated values are reflected"] },
  "SAM-24902": { objective: "Validate selecting a saved address during registered CO checkout.", expected: "A saved shipping/billing address can be selected and used to continue checkout.", steps: ["Restore registered CO session and enter Delivery", "Select a saved shipping address", "Select a saved billing address", "Continue to payment", "Validate the selected address is reflected"] },
  "SAM-24903": { objective: "Validate the save-address option for a registered CO user.", expected: "Registered users can save checkout addresses for future use.", steps: ["Restore registered CO session", "Enter a new shipping address", "Enable save-address option", "Enter/save billing address", "Return to Delivery and validate the saved address is available"] },
  "SAM-24904": { objective: "Validate registered checkout with a new CO address.", expected: "A registered user can use a new non-saved address and reach payment successfully.", steps: ["Restore registered CO session and enter checkout", "Select New Address", "Populate new shipping/billing address", "Keep the new address non-persistent when required", "Continue to payment and validate the new address summary"] },
  "SAM-24905": { objective: "Validate guest users cannot save checkout addresses.", expected: "Save-address controls are not available/enabled for guest checkout.", steps: ["Start guest checkout", "Populate Contact Details", "Open Delivery address section", "Inspect save-address controls", "Validate guest save options are disabled or unavailable"] },
  "SAM-24909": { objective: "Validate invalid-address feedback in CO checkout.", expected: "Invalid address data is rejected and checkout remains on Delivery with a clear validation message.", steps: ["Start guest checkout and reach Delivery", "Populate an invalid address value", "Attempt to continue to payment", "Validate the address error message", "Confirm checkout remains on Delivery"] },
  "SAM-24910": { objective: "Validate switching saved/new address modes during registered CO checkout.", expected: "The user can switch address modes and the selected mode is reflected correctly.", steps: ["Restore registered CO session and reach Delivery", "Select saved shipping address", "Switch to New Address", "Validate the saved address is deselected", "Switch back and validate the saved address is selected"] },
  "SAM-24911": { objective: "Validate the Back to Top control on the CO cart.", expected: "The Back to Top control is rendered after scrolling and returns the cart view to the top.", steps: ["Add product and open cart", "Scroll to the bottom of the cart page", "Locate the Back to Top control", "Activate Back to Top", "Validate the cart header returns into view"] },
  "SAM-24912": { objective: "Validate registered-user credit/debit-card payment in CO.", expected: "A registered user can complete the card checkout flow and receive a valid CO order number.", steps: ["Restore registered CO session and prepare a clean cart", "Proceed through Delivery and mandatory consents", "Reach Payment", "Select and populate Credit/Debit Card", "Submit the authorized payment", "Validate the CO order confirmation/order code"] },
  "SAM-24914": { objective: "Validate the source-defined CO alternative payment journey (PSE/ADDI source mapping requires confirmation).", expected: "The required payment option must be available before the payment flow can be automated and validated.", steps: ["Prepare checkout and reach Payment", "Inspect available payment methods", "Locate the source-required payment option", "Continue only when the required method/prerequisites are available", "Validate the payment outcome"] },
  "SAM-24915": { objective: "Validate payment using Samsung Rewards in CO.", expected: "Rewards payment can be selected and completed when the required Rewards account/test data are available.", steps: ["Prepare checkout with eligible Rewards account/data", "Reach Payment", "Select Rewards", "Apply the required Rewards value", "Validate payment continuation/order result"] },
  "SAM-24919": { objective: "Validate CO guest Track Order using a freshly created order.", expected: "A guest order can be located using order number/email verification and the tracked order details are displayed.", steps: ["Create a fresh guest CO order", "Capture the public order number and guest email", "Open Track Order", "Request and retrieve the verification code", "Submit verification", "Validate the tracked order details"] },
  "SAM-24920": { objective: "Validate CO BackOffice order search/read access.", expected: "BackOffice opens successfully and an order can be located/read with a valid status.", steps: ["Authenticate to the target BackOffice environment", "Open the Orders area", "Search/open an order", "Read order code and status", "Validate both values are available"] },
  "SAM-24925": { objective: "Validate mobile sticky checkout behavior in CO.", expected: "Checkout action remains available/usable in the mobile cart viewport.", steps: ["Add product to cart", "Switch to mobile viewport", "Open cart", "Locate the sticky checkout action", "Validate the checkout action is visible and usable"] },
};

function upsertLabel(labels, name, value) {
  const next = (labels || []).filter((label) => label.name !== name);
  if (value) next.push({ name, value });
  return next;
}

function addTag(labels, value) {
  if (value && !labels.some((label) => label.name === "tag" && label.value === value)) labels.push({ name: "tag", value });
}

function prettyStatus(status) {
  if (/blocked|skipped/i.test(String(status || ""))) return "BLOCKED";
  if (/pass|expected/i.test(String(status || ""))) return "PASS";
  if (/fail|unexpected|timedout|interrupted/i.test(String(status || ""))) return "FAIL";
  return String(status || "NOT_RUN").toUpperCase();
}

function blockerCategory(text = "") {
  if (/auth|session|login|credential|account/i.test(text)) return "Authentication / session";
  if (/card|payment|pse|addi|rewards|method/i.test(text)) return "Payment prerequisite / configuration";
  if (/sku|product|care\+|sc\+|eligible|data|address/i.test(text)) return "Test data / prerequisite";
  if (/timeout|backend|server|environment|staging|network|endpoint/i.test(text)) return "Environment / backend";
  return "Application / prerequisite";
}

function caseFeature(entry) {
  const feature = String(entry?.feature || "Storefront");
  if (/order|backoffice/i.test(feature)) return "Order & BackOffice";
  if (/auth/i.test(feature)) return "Account & Profile";
  if (/payment/i.test(feature)) return "Payment";
  if (/checkout/i.test(feature)) return "Checkout";
  if (/cart/i.test(feature)) return "Cart & Promotions";
  if (/product/i.test(feature)) return "Product & Catalog";
  return "Storefront UI";
}

function businessSteps(result, details) {
  const technical = /^(before hooks?|after hooks?|navigate|expect\b|wait for|waitfor|locator\b|request\b|page\.|browser\.|context\.|api\b|fixture\b|query count|evaluate|click|hover|press|fill|check|uncheck)/i;
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
  result.steps = (details.steps || []).map((name, index) => ({
    name: `Business validation · ${name}`,
    status: "skipped",
    stage: "finished",
    start,
    stop,
    steps: [],
    attachments: [],
    parameters: [],
    statusDetails: { message: "Business journey outline derived from the official TC; Playwright trace contains the measured technical actions." },
  }));
}

function description(samId, entry, details, runtimeTest) {
  const status = prettyStatus(runtimeTest?.status);
  const reason = runtimeTest?.blockedReason || runtimeTest?.error || "";
  return [
    `### [${samId}](${JIRA_BASE_URL}${samId}) · ${entry.title}`,
    "",
    `**Objective:** ${details.objective}`,
    `**Expected result:** ${details.expected}`,
    "",
    `**Market:** CO`,
    `**Environment:** ${environmentLabel}`,
    `**Store:** Base Store`,
    `**Suite:** P1 / QST`,
    `**Runtime status:** ${status}`,
    runtimeTest?.duration != null ? `**Duration:** ${(Number(runtimeTest.duration) / 1000).toFixed(1)}s` : null,
    status === "BLOCKED" && reason ? `**Blocker category:** ${blockerCategory(reason)}` : null,
    reason ? `**Runtime detail:** ${String(reason).split("\n")[0]}` : null,
    "",
    "_Business steps below describe the official validation journey. Technical locator/request detail remains in Playwright Trace._",
  ].filter(Boolean).join("  \n");
}

for (const fileName of fs.readdirSync(resultsDir).filter((name) => name.endsWith("-result.json"))) {
  const file = path.join(resultsDir, fileName);
  const result = JSON.parse(fs.readFileSync(file, "utf8"));
  const searchable = `${result.name || ""} ${result.fullName || ""}`;
  const samId = searchable.match(/SAM-\d+/)?.[0];
  const entry = samId ? plan.cases[samId] : null;
  if (!samId || !entry || entry.store !== "BS") continue;

  const details = CASE_DETAILS[samId] || {
    objective: `Validate the official CO scenario: ${entry.title}.`,
    expected: `The official ${samId} business result is satisfied.`,
    steps: ["Prepare the CO test context", "Execute the official business scenario", "Validate the expected result"],
  };
  const runtimeTest = byId.get(samId);
  const cleanTitle = String(entry.title || result.name || samId).replace(/^SAM-\d+\s*[-–:]?\s*/i, "").trim();
  const feature = caseFeature(entry);

  // Remove adapter/project noise (notably the generic "chromium" suite/package)
  // and rebuild the hierarchy as business-facing Samsung metadata.
  const removeLabels = new Set(["parentSuite", "suite", "subSuite", "package", "thread", "host"]);
  result.labels = (result.labels || []).filter((label) => !removeLabels.has(label.name) && !(label.name === "tag" && /^chromium$/i.test(label.value || "")));
  result.labels = upsertLabel(result.labels, "parentSuite", "Samsung SMB Automation");
  result.labels = upsertLabel(result.labels, "suite", `CO · ${targetEnvironment} · Base Store`);
  result.labels = upsertLabel(result.labels, "subSuite", `P1 / QST · ${feature}`);
  result.labels = upsertLabel(result.labels, "epic", "Samsung SMB Commerce");
  result.labels = upsertLabel(result.labels, "feature", feature);
  result.labels = upsertLabel(result.labels, "story", cleanTitle);
  result.labels = upsertLabel(result.labels, "severity", "critical");
  result.labels = upsertLabel(result.labels, "owner", "Samsung SMB QA");
  result.labels = upsertLabel(result.labels, "testCaseId", samId);
  result.labels = upsertLabel(result.labels, "layer", "e2e");
  for (const tag of ["CO", targetEnvironment, "Base Store", "P1", "QST"]) addTag(result.labels, tag);

  result.name = `${samId} · ${cleanTitle}`;
  result.fullName = `Samsung SMB Automation > CO > ${targetEnvironment} > Base Store > P1/QST > ${samId} · ${cleanTitle}`;
  result.links = (result.links || []).filter((link) => link.type !== "tms" && link.name !== samId);
  result.links.push({ name: samId, url: `${JIRA_BASE_URL}${samId}`, type: "tms" });
  result.description = description(samId, entry, details, runtimeTest);
  businessSteps(result, details);

  result.parameters = (result.parameters || []).filter((item) => !/^(project|browser|browserName)$/i.test(String(item.name || "")));
  const parameters = {
    Market: "CO",
    Environment: environmentLabel,
    Store: "Base Store",
    Suite: "P1 / QST",
    "Official TC": samId,
    Feature: feature,
  };
  for (const [name, value] of Object.entries(parameters)) {
    result.parameters = result.parameters.filter((item) => item.name !== name);
    result.parameters.push({ name, value });
  }

  const runtimeStatus = prettyStatus(runtimeTest?.status);
  addTag(result.labels, `runtime:${runtimeStatus}`);
  if (runtimeStatus === "BLOCKED") {
    addTag(result.labels, "BLOCKED");
    addTag(result.labels, `blocker:${blockerCategory(runtimeTest?.blockedReason || runtimeTest?.error || "")}`);
  }

  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

const environment = [
  "Project=Samsung SMB Automation",
  "Platform=SAP Commerce / Hybris",
  "Framework=Playwright",
  "Market=CO",
  `Environment=${environmentLabel.replaceAll(" ", "")}`,
  "Store=Base Store",
  "Suite=P1/QST",
  "Official_BaseStore_P1=29",
  `Branch=${process.env.BRANCH_NAME || process.env.GIT_BRANCH || "local"}`,
  `Build=${process.env.BUILD_NUMBER || "local"}`,
  `GitCommit=${process.env.GIT_COMMIT || runtime.gitCommit || "unknown"}`,
].join("\n") + "\n";
fs.writeFileSync(path.join(resultsDir, "environment.properties"), environment);

fs.writeFileSync(path.join(resultsDir, "categories.json"), JSON.stringify([
  { name: "Authentication / session", matchedStatuses: ["failed", "broken"], messageRegex: ".*(auth|session|login|credential|account).*" },
  { name: "Payment prerequisite / configuration", matchedStatuses: ["failed", "broken"], messageRegex: ".*(card|payment|PSE|ADDI|Rewards|payment method).*" },
  { name: "Test data / prerequisite", matchedStatuses: ["failed", "broken"], messageRegex: ".*(SKU|product|eligible|Care\\+|SC\\+|address|test data).*" },
  { name: "Environment / backend", matchedStatuses: ["failed", "broken"], messageRegex: ".*(timeout|backend|server|environment|staging|network|endpoint).*" },
  { name: "Product defects", matchedStatuses: ["failed", "broken"], messageRegex: ".*" },
], null, 2));

console.log(`[allure] CO business reporting enriched for ${Object.keys(CASE_DETAILS).length} Base Store P1 TCs.`);
