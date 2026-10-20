const path = require("node:path");
const plan = require("../governance/cl-qst-plan.json");
const { enrichOfficialQst } = require("../reporting/allure/officialQstEnrichment.cjs");
const { getClQstConfig } = require("../config/markets/cl");

const resultsDir = path.resolve(process.argv[2] || process.env.ALLURE_RESULTS_DIR || "allure-results");
const runtimeFile = path.resolve(process.argv[3] || path.join(process.env.CL_QST_ARTIFACT_DIR || "test-results/jenkins/cl-base-store", "runtime-summary.json"));
const evidenceRoot = path.resolve(process.argv[4] || path.join(path.dirname(runtimeFile), "evidence"));
const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.ENVIRONMENT || "S2").toUpperCase();
const config = getClQstConfig({ ...process.env, CL_QST_ENVIRONMENT: environment });

// Explicitly reviewed against governance/cl-qst-plan.json on 2026-10-20.
// Keep this hand-audited list so official-scope drift cannot silently degrade Allure.
const AUDITED_BASE_STORE_IDS = Object.freeze([
  "SAM-24784", "SAM-24785", "SAM-24786", "SAM-24790", "SAM-24791",
  "SAM-24793", "SAM-24794", "SAM-24797", "SAM-24803", "SAM-24804",
  "SAM-24806", "SAM-24807", "SAM-24808", "SAM-24810", "SAM-24811",
  "SAM-24812", "SAM-24813", "SAM-24814", "SAM-24815", "SAM-24816",
  "SAM-24817", "SAM-24818", "SAM-24819", "SAM-24821", "SAM-24822",
  "SAM-24823", "SAM-24824", "SAM-24825", "SAM-24826", "SAM-24830",
  "SAM-24831",
]);

const DETAILS = {
  "SAM-24785": {
    objective: "Validate the CL My Profile address lifecycle with QA-only data.",
    expected: "A registered user can create, edit and remove the controlled QA address and cleanup leaves no residual test address.",
    steps: ["Restore registered CL session", "Open address management", "Create QA-only address", "Edit the created address", "Delete the QA address", "Validate cleanup"],
    feature: "Account & Profile",
    userType: "Registered",
  },
  "SAM-24786": {
    objective: "Validate the registered CL My Orders page and available order references.",
    expected: "My Orders opens for the authenticated account and exposes order information or a valid empty-history state.",
    feature: "Order & BackOffice",
    userType: "Registered",
  },
  "SAM-24790": {
    objective: "Validate the controlled CL product can be added from PDP to cart.",
    expected: "The configured SKU is added successfully and is observable in cart with product/network evidence.",
    feature: "Product & Catalog",
  },
  "SAM-24797": {
    objective: "Validate an active CL BOGO campaign using an eligible source SKU.",
    expected: "The eligible source product and promotional gift indicator are represented in cart; missing campaign eligibility is treated as test-data prerequisite.",
    feature: "Cart & Promotions",
  },
  "SAM-24803": {
    objective: "Validate Recycle & Save / Trade-in while tracking the mapped SAM-25150 defect.",
    expected: "Trade-in should retain/display the expected device and trade amount; the mapped missing-trade-amount symptom is reported as Known Defect rather than an unrelated failure.",
    feature: "Cart & Promotions",
  },
  "SAM-24804": {
    objective: "Validate Samsung Care+ for an eligible CL product.",
    expected: "SC+ is available when an eligible SKU exists; missing eligible product data remains an explicit prerequisite blocker.",
    feature: "Cart & Promotions",
  },
  "SAM-24807": {
    objective: "Validate legitimate Samsung Account login initiated from CL checkout.",
    expected: "Checkout reaches the real Samsung Account flow and returns to authenticated CL checkout after any required human verification.",
    steps: ["Prepare legitimate Samsung Account state", "Start checkout as registered user", "Open Samsung Account login", "Complete required human verification when presented", "Return to CL checkout", "Validate authenticated Delivery state"],
    feature: "Account & Profile",
    userType: "Registered",
  },
  "SAM-24811": {
    objective: "Validate adding/editing a saved or new address during registered CL checkout.",
    expected: "Controlled address data can be persisted from checkout and is visible in My Profile, with QA cleanup performed after validation.",
    feature: "Checkout",
    userType: "Registered",
  },
  "SAM-24816": {
    objective: "Validate distinct shipping and billing address data in CL checkout.",
    expected: "Shipping and billing values remain independently represented and are not unintentionally overwritten.",
    feature: "Checkout",
    userType: "Guest",
  },
  "SAM-24821": {
    objective: "Validate Back to Top on the CL cart while tracking RT-746043 when the control is missing.",
    expected: "The control returns the viewport to the top when available; the exact mapped missing-control symptom is SKIPPED/KNOWN DEFECT and does not mask unrelated failures.",
    feature: "Storefront UI",
  },
  "SAM-24822": {
    objective: "Validate an authorized registered-user CL credit/debit-card payment.",
    expected: "The payment reaches Samsung confirmation and exposes a valid CL Order ID when destructive submission is explicitly authorized.",
    steps: ["Restore registered CL session", "Prepare one controlled cart item", "Reach Payment", "Select and validate Credit/Debit Card", "Submit the authorized payment once", "Capture Order ID and payment/network evidence", "Validate Samsung confirmation"],
    feature: "Payment",
    userType: "Registered",
    paymentMode: "Credit / Debit Card",
  },
  "SAM-24823": {
    objective: "Validate an authorized CL Direct Bank Transfer payment journey.",
    expected: "The configured bank-transfer journey reaches its accepted outcome and preserves payment/order evidence when an order is created.",
    feature: "Payment",
    paymentMode: "Direct Bank Transfer",
  },
  "SAM-24824": {
    objective: "Validate CL interest-free installment payment using the supported card path.",
    expected: "The installment option is selectable and the authorized payment outcome is proven with order evidence when submitted.",
    feature: "Payment",
    paymentMode: "Interest-free installments",
  },
  "SAM-24825": {
    objective: "Validate Samsung Rewards payment only with a verified eligible CL Rewards balance and redemption fixture.",
    expected: "Rewards payment is exercised when prerequisites exist; missing points/configuration is reported as a payment prerequisite blocker.",
    feature: "Payment",
    paymentMode: "Samsung Rewards",
    userType: "Rewards-capable account",
  },
  "SAM-24826": {
    objective: "Validate the CL order-confirmation screen after an authorized payment submission.",
    expected: "A new CL Order ID is created and the Samsung confirmation screen visibly represents the same order.",
    steps: ["Prepare controlled checkout", "Reach Payment", "Submit one authorized payment", "Capture Order ID and payment outcome", "Validate the confirmation screen", "Preserve order/network evidence"],
    feature: "Payment",
  },
  "SAM-24830": {
    objective: "Validate CL BackOffice order and product search/read access.",
    expected: "BackOffice authentication succeeds and order/product data can be found in the required search modes.",
    feature: "Order & BackOffice",
    userType: "BackOffice",
  },
  "SAM-24831": {
    objective: "Validate the CL BackOffice order process/status for the controlled reference order.",
    expected: "The order can be opened and its process/status matches the official checkpoint for the target environment.",
    feature: "Order & BackOffice",
    userType: "BackOffice",
  },
};

enrichOfficialQst({
  market: "CL",
  resultsDir,
  runtimeFile,
  evidenceRoot,
  environment,
  store: "BASE_STORE",
  cases: plan.cases,
  auditedIds: AUDITED_BASE_STORE_IDS,
  detailsById: DETAILS,
  defaults: {
    sku: config.sku,
    pdpUrl: config.pdpUrl.href,
  },
});
