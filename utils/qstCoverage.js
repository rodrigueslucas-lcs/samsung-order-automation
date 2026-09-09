const smbMapping = require("../test-mapping/smb-qst.json");
const mxCoverage = require("../test-mapping/mx-qst-coverage.json");

const COVERAGE_STATES = Object.freeze(["full", "partial", "missing"]);
const STORES = Object.freeze(["BS", "EPP"]);
const FEATURES = Object.freeze([
  "Auth/Home",
  "Product",
  "Cart",
  "Checkout",
  "Payment",
  "Order/BackOffice",
  "UI/Other",
]);

function validateMxQstCoverage() {
  const errors = [];
  const officialIds = smbMapping.markets?.MX?.cases || [];
  const coverageCases = mxCoverage.cases || {};
  const coverageIds = Object.keys(coverageCases);

  if (mxCoverage.market !== "MX") {
    errors.push(`coverage market: expected MX, found ${mxCoverage.market || "<missing>"}`);
  }

  if (mxCoverage.officialTotal !== officialIds.length) {
    errors.push(
      `MX officialTotal: expected ${officialIds.length}, found ${mxCoverage.officialTotal}`
    );
  }

  const missingIds = officialIds.filter((id) => !coverageCases[id]);
  const extraIds = coverageIds.filter((id) => !officialIds.includes(id));
  if (missingIds.length) errors.push(`MX coverage missing IDs: ${missingIds.join(", ")}`);
  if (extraIds.length) errors.push(`MX coverage extra IDs: ${extraIds.join(", ")}`);

  const counts = { full: 0, partial: 0, missing: 0 };
  for (const id of officialIds) {
    const current = coverageCases[id];
    if (!current) continue;

    if (!current.title || !String(current.title).trim()) {
      errors.push(`${id}: official title is required`);
    }
    if (!STORES.includes(current.store)) {
      errors.push(`${id}: invalid store ${current.store || "<missing>"}`);
    }
    if (!FEATURES.includes(current.feature)) {
      errors.push(`${id}: invalid feature ${current.feature || "<missing>"}`);
    }

    if (!COVERAGE_STATES.includes(current.coverage)) {
      errors.push(`${id}: invalid coverage state ${current.coverage || "<missing>"}`);
      continue;
    }

    counts[current.coverage] += 1;

    if (current.coverage !== "missing") {
      if (!current.spec || !current.test) {
        errors.push(`${id}: ${current.coverage} coverage requires spec and test references`);
      }
    }

    if (!current.notes || !String(current.notes).trim()) {
      errors.push(`${id}: coverage notes are required`);
    }
  }

  for (const state of COVERAGE_STATES) {
    if (mxCoverage.summary?.[state] !== counts[state]) {
      errors.push(
        `MX summary ${state}: declared ${mxCoverage.summary?.[state]}, actual ${counts[state]}`
      );
    }
  }

  const classifiedTotal = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (classifiedTotal !== officialIds.length) {
    errors.push(`MX classified total: expected ${officialIds.length}, found ${classifiedTotal}`);
  }

  if (errors.length) {
    throw new Error(`Invalid MX QST coverage mapping:\n${errors.join("\n")}`);
  }

  return {
    market: "MX",
    officialTotal: officialIds.length,
    ...counts,
  };
}

module.exports = {
  COVERAGE_STATES,
  FEATURES,
  STORES,
  validateMxQstCoverage,
};
