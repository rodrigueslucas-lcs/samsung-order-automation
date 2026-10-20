const path = require("node:path");
const coverage = require("../governance/mx-qst-coverage.json");
const { enrichOfficialQst } = require("../reporting/allure/officialQstEnrichment.cjs");
const { getMxConfig } = require("../utils/mxConfig");

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || path.join(process.env.MX_QST_ARTIFACT_DIR || "test-results/jenkins/mx-qst", "runtime-summary.json"));
const evidenceRoot = path.resolve(process.argv[4] || path.join(path.dirname(runtimeFile), "evidence"));
const environment = String(process.env.MX_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const config = getMxConfig({ ...process.env, MX_QST_ENVIRONMENT: environment });
const cases = Object.fromEntries(Object.entries(coverage.cases).map(([id, entry]) => [id, { ...entry, store: entry.store === "BS" ? "BASE_STORE" : entry.store }]));

// Explicit 29-TC active Base Store P1 audit. SAM-25006 is intentionally excluded
// because governance marks it historical-only; it must not inflate active scope.
const AUDITED_BASE_STORE_IDS = Object.freeze([
  "SAM-24962", "SAM-24963", "SAM-24964", "SAM-24968", "SAM-24969",
  "SAM-24971", "SAM-24972", "SAM-24975", "SAM-24981", "SAM-24982",
  "SAM-24985", "SAM-24986", "SAM-24988", "SAM-24989", "SAM-24990",
  "SAM-24991", "SAM-24992", "SAM-24993", "SAM-24994", "SAM-24995",
  "SAM-24999", "SAM-25000", "SAM-25001", "SAM-25002", "SAM-25004",
  "SAM-25005", "SAM-25010", "SAM-25011", "SAM-25016",
]);

const DETAILS = {
  "SAM-24969": {
    objective: "Validate the MX buying-category/PDP journey can add the controlled product to cart.",
    expected: "The product is added through the supported storefront path and the cart mutation is proven with SKU/network evidence.",
    feature: "Product & Catalog",
  },
  "SAM-24975": {
    objective: "Validate Samsung Rewards messaging across the supported MX cart/checkout/payment surfaces.",
    expected: "Rewards messaging is visible in the applicable surfaces; any documented tooltip/path gap remains explicit rather than being overstated as full coverage.",
    feature: "Checkout",
    userType: "Rewards-capable account",
  },
  "SAM-24981": {
    objective: "Validate Samsung Care+ availability and cart behavior for an eligible MX product.",
    expected: "SC+ is reflected correctly when an eligible SKU is used; missing eligibility is reported as test-data prerequisite rather than a false product failure.",
    feature: "Cart & Promotions",
  },
  "SAM-24982": {
    objective: "Validate the MX Trade-up interaction while preserving the controlled cart product.",
    expected: "The Trade-up journey is accessible for eligible data and its resulting cart behavior remains observable.",
    feature: "Cart & Promotions",
  },
  "SAM-24985": {
    objective: "Validate Extended Warranty can be added for an eligible MX product and is associated with the cart entry.",
    expected: "The eligible warranty/service pack is reflected in cart with the controlled product.",
    feature: "Cart & Promotions",
  },
  "SAM-24986": {
    objective: "Validate cart isolation across the dedicated second MX account/session.",
    expected: "Cart state from one account is not incorrectly exposed to the other account/session.",
    feature: "Cart & Promotions",
    userType: "Registered / second account",
  },
  "SAM-24991": {
    objective: "Validate the registered MX checkout address journey represented by the current automation.",
    expected: "New/saved address behavior that is implemented is proven while any remaining official edit-path gap stays visible in coverage metadata.",
    feature: "Checkout",
    userType: "Registered",
  },
  "SAM-24999": {
    objective: "Validate invalid MX address/postal-code data is rejected before normal Delivery progression.",
    expected: "A clear validation barrier is observable and checkout does not silently accept invalid address data.",
    feature: "Checkout",
  },
  "SAM-25001": {
    objective: "Validate the MX Back to Top control on cart.",
    expected: "The control is visible after scrolling and returns the cart viewport to the top.",
    feature: "Storefront UI",
  },
  "SAM-25002": {
    objective: "Validate an authorized registered-user MX Mercado Pago card purchase end to end.",
    expected: "The payment reaches Samsung order confirmation and exposes a valid MX Order ID when destructive submission is explicitly authorized.",
    steps: ["Restore registered MX session", "Prepare one controlled cart item", "Reach Payment", "Populate and validate the configured test card", "Submit the authorized payment once", "Capture Order ID and payment/network evidence", "Validate Samsung confirmation"],
    feature: "Payment",
    userType: "Registered",
    paymentMode: "Credit / Debit Card",
  },
  "SAM-25004": {
    objective: "Validate PayPal is available/selectable in MX without claiming an order when submission is intentionally not performed.",
    expected: "PayPal availability and controlled selection are proven safely; order success remains unclaimed without authorized submit evidence.",
    feature: "Payment",
    paymentMode: "PayPal",
  },
  "SAM-25005": {
    objective: "Validate Pay in Cash is available/selectable in MX without claiming an order when submission is intentionally not performed.",
    expected: "Cash-payment availability and controlled selection are proven safely; order success remains unclaimed without authorized submit evidence.",
    feature: "Payment",
    paymentMode: "Cash Payment",
  },
  "SAM-25010": {
    objective: "Validate MX Track Order using a causal order, verification email and OTP flow.",
    expected: "The order-tracking flow accepts the valid verification code and resolves the order unless the exact mapped RT-738525 environment defect reproduces.",
    steps: ["Create or reuse the causal guest order", "Capture Order ID and guest mailbox", "Request Track Order verification", "Read the OTP email", "Submit the OTP", "Validate tracked order details or mapped Known Defect"],
    feature: "Order & BackOffice",
    userType: "Guest",
  },
  "SAM-25011": {
    objective: "Validate MX BackOffice order and product search in the target staging environment.",
    expected: "BackOffice authentication succeeds and order/product data can be located in the required search modes.",
    feature: "Order & BackOffice",
    userType: "BackOffice",
  },
};

enrichOfficialQst({
  market: "MX",
  resultsDir,
  runtimeFile,
  evidenceRoot,
  environment,
  store: "BASE_STORE",
  cases,
  auditedIds: AUDITED_BASE_STORE_IDS,
  detailsById: DETAILS,
  defaults: {
    sku: process.env.MX_QST_SKU || config.sku,
    pdpUrl: new URL(`/mx/p/${process.env.MX_QST_SKU || config.sku}`, config.baseUrl.origin).href,
  },
});
