const path = require("node:path");
const plan = require("../governance/co-qst-plan.json");
const { enrichOfficialQst } = require("../reporting/allure/officialQstEnrichment.cjs");
const { getCoQstConfig } = require("../config/markets/co");

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || path.join(process.env.CO_QST_ARTIFACT_DIR || "test-results/jenkins/co-qst", "runtime-summary.json"));
const evidenceRoot = path.resolve(process.argv[4] || path.join(path.dirname(runtimeFile), "evidence"));
const environment = String(process.env.CO_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const config = getCoQstConfig({ ...process.env, CO_QST_ENVIRONMENT: environment });
const cases = Object.fromEntries(Object.entries(plan.cases).map(([id, entry]) => [id, { ...entry, store: entry.store === "BS" ? "BASE_STORE" : entry.store }]));

// Explicitly reviewed against governance/co-qst-plan.json on 2026-10-20.
// This list is deliberately not generated: drift must fail loudly if the official
// inventory changes without a corresponding Allure/reporting review.
const AUDITED_BASE_STORE_IDS = Object.freeze([
  "SAM-24806", "SAM-24873", "SAM-24874", "SAM-24875", "SAM-24879",
  "SAM-24880", "SAM-24882", "SAM-24883", "SAM-24886", "SAM-24892",
  "SAM-24893", "SAM-24896", "SAM-24898", "SAM-24899", "SAM-24900",
  "SAM-24901", "SAM-24902", "SAM-24903", "SAM-24904", "SAM-24905",
  "SAM-24909", "SAM-24910", "SAM-24911", "SAM-24912", "SAM-24914",
  "SAM-24915", "SAM-24919", "SAM-24920", "SAM-24925",
]);

const DETAILS = {
  "SAM-24880": {
    objective: "Validate a product can be selected from the CO buying-category/PDP journey and added to cart.",
    expected: "The controlled CO product is added successfully and the cart mutation is observable.",
    steps: ["Open the controlled CO catalog/product journey", "Add the selected product to cart", "Validate the cart mutation", "Validate the controlled SKU is represented in cart", "Preserve product and request/response evidence"],
    feature: "Product & Catalog",
  },
  "SAM-24892": {
    objective: "Validate Samsung Care+ for an eligible CO product without treating missing eligible test data as a product failure.",
    expected: "SC+ is addable when an eligible product is available; otherwise the scenario is reported as an explicit test-data prerequisite blocker.",
    feature: "Cart & Promotions",
  },
  "SAM-24893": {
    objective: "Validate the CO Trade-up service on cart for an eligible product.",
    expected: "Trade-up is available and usable when eligible; a mapped storefront defect is reported separately as Known Defect rather than a generic automation failure.",
    feature: "Cart & Promotions",
  },
  "SAM-24911": {
    objective: "Validate Back to Top on the CO cart while preserving the mapped RT-746043 defect classification when the control is absent.",
    expected: "The control returns the cart to the top when available; the exact mapped missing-control symptom is reported as Known Defect.",
    feature: "Storefront UI",
  },
  "SAM-24912": {
    objective: "Validate an authorized registered-user credit/debit-card purchase in CO.",
    expected: "The card flow reaches Samsung order confirmation and exposes a valid CO order ID when destructive submission is explicitly authorized.",
    steps: ["Restore registered CO session", "Prepare one controlled cart item", "Reach Payment", "Populate and validate the configured test card", "Submit the authorized payment once", "Capture Order ID and payment/network evidence", "Validate Samsung confirmation"],
    feature: "Payment",
    userType: "Registered",
    paymentMode: "Credit / Debit Card",
  },
  "SAM-24914": {
    objective: "Validate the source-defined CO alternative payment path only when its required method/configuration is available.",
    expected: "Unavailable payment configuration is represented as a payment prerequisite blocker, not a false functional failure.",
    feature: "Payment",
  },
  "SAM-24915": {
    objective: "Validate Samsung Rewards payment for an eligible CO Rewards account.",
    expected: "Rewards is available/selectable with the required account balance and configuration; missing Rewards prerequisites remain explicit blockers.",
    feature: "Payment",
    paymentMode: "Samsung Rewards",
    userType: "Rewards-capable account",
  },
  "SAM-24919": {
    objective: "Validate guest Track Order using a causal CO order and verification email.",
    expected: "The order can be located with the captured Order ID/email verification flow and its tracking details are displayed.",
    steps: ["Create or load the causal guest order", "Capture Order ID and guest mailbox context", "Open Track Order", "Request and retrieve the verification code", "Submit verification", "Validate tracked order details and preserve order evidence"],
    feature: "Order & BackOffice",
    userType: "Guest",
  },
  "SAM-24920": {
    objective: "Validate CO BackOffice order search/read access in the target environment.",
    expected: "BackOffice authentication succeeds and a real order can be found with readable Order ID and status.",
    feature: "Order & BackOffice",
    userType: "BackOffice",
  },
};

enrichOfficialQst({
  market: "CO",
  resultsDir,
  runtimeFile,
  evidenceRoot,
  environment,
  store: "BASE_STORE",
  cases,
  auditedIds: AUDITED_BASE_STORE_IDS,
  detailsById: DETAILS,
  defaults: {
    sku: config.sku,
    pdpUrl: config.pdpUrl.href,
  },
});
