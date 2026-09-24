const MX_BASE_P1_SOURCE_IDS = Object.freeze([
  "SAM-24962", "SAM-24963", "SAM-24964", "SAM-24968", "SAM-24969",
  "SAM-24971", "SAM-24972", "SAM-24975", "SAM-24981", "SAM-24982",
  "SAM-24985", "SAM-24986", "SAM-24988", "SAM-24989", "SAM-24990",
  "SAM-24991", "SAM-24992", "SAM-24993", "SAM-24994", "SAM-24995",
  "SAM-24999", "SAM-25000", "SAM-25001", "SAM-25002", "SAM-25004",
  "SAM-25005", "SAM-25006", "SAM-25010", "SAM-25011", "SAM-25016",
]);

const MX_BASE_P1_EXCLUSIONS = Object.freeze({
  "SAM-25006": Object.freeze({
    id: "SAM-25006",
    title: "Payment using Rewards",
    market: "MX",
    context: "BASE_STORE",
    excludedFromActiveQst: true,
    preserveHistoricalTraceability: true,
    clarifiedAt: "2026-09-24",
    reason: "Samsung SMB QA clarified that the PSE bank-payment path in this MX test data was copied from Colombia and is not an MX payment path. The active MX QST runner excludes this case until a valid MX-specific Rewards execution path is defined.",
    sourceNote: "SMB QA clarification received 2026-09-24; historical/source-template traceability is intentionally preserved.",
  }),
});

const MX_BASE_P1_IDS = Object.freeze(
  MX_BASE_P1_SOURCE_IDS.filter((id) => !MX_BASE_P1_EXCLUSIONS[id]),
);

function mxScopeExclusion(id) {
  return MX_BASE_P1_EXCLUSIONS[id] || null;
}

module.exports = {
  MX_BASE_P1_SOURCE_IDS,
  MX_BASE_P1_EXCLUSIONS,
  MX_BASE_P1_IDS,
  mxScopeExclusion,
};
