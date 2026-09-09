const registry = require("../test-mapping/smb-qst.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");
const peReuse = require("../test-mapping/pe-qst-reuse-plan.json");

const REGISTERED = new Set([
  // MX official titles/coverage notes explicitly require registered/account state.
  "MX:SAM-24962", // Login Home page
  "MX:SAM-24963", // My Account
  "MX:SAM-24986", // Cart value when registered user logs out
  "MX:SAM-24991", // Add/Edit saved/new address
  "MX:SAM-24992", // Select saved address
  "MX:SAM-24993", // Save option for reg user
  "MX:SAM-25002", // credit card with reg user
  "MX:SAM-25045", // EPP credit card with reg user
  // PE official reuse-plan titles/notes explicitly require registered/account state.
  "PE:SAM-25055", // Login Home page
  "PE:SAM-25056", // profile address management
  "PE:SAM-25057", // My Orders
  "PE:SAM-25080", // Login from Checkout page
  "PE:SAM-25084", // Add/Edit saved/new address
  "PE:SAM-25085", // Select saved address
  "PE:SAM-25086", // Save option for reg user
  "PE:SAM-25087", // reuse plan notes official case is registered user
  "PE:SAM-25095", // card with reg user
  "PE:SAM-25138", // EPP card with reg user
]);

const GUEST = new Set([
  "MX:SAM-24975", // architecture source: rewards text as a Guest User
  "MX:SAM-24995", // Save option not visible; current official path is guest
  "PE:SAM-25088", // Save option not visible; reuse plan identifies guest checkout
]);

function metadataFor(market, id) {
  if (market === "MX") return mxCoverage.cases?.[id] || null;
  if (market === "PE") return peReuse.cases?.[id] || null;
  return null;
}

function getExecutionRequirement(market, id) {
  const code = String(market || "").trim().toUpperCase();
  if (!registry.markets?.[code]?.cases?.includes(id)) {
    throw new Error(`${id} is not an official ${code || "unknown"} SMB QST ID.`);
  }
  const key = `${code}:${id}`;
  const metadata = metadataFor(code, id);
  const accountContext = REGISTERED.has(key) ? "registered" : GUEST.has(key) ? "guest" : "unknown";
  const store = metadata?.store || "Unknown";
  return {
    market: code,
    id,
    accountContext,
    requiresSamsungAccount: accountContext === "registered",
    requiresGuestState: accountContext === "guest",
    store,
    requiresEppContext: store === "EPP",
  };
}

module.exports = {
  GUEST,
  REGISTERED,
  getExecutionRequirement,
};
