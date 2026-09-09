const sharedCore = require("../test-mapping/smb-shared-core-families.json");

function getSharedCandidatesByMarket(market) {
  const code = String(market || "").trim().toUpperCase();
  const candidates = [];

  for (const family of sharedCore.families || []) {
    for (const id of family.ids?.[code] || []) {
      candidates.push({
        id,
        family: family.family,
        feature: family.feature,
        stores: family.stores || [],
        marketCount: family.marketCount,
      });
    }
  }

  return candidates.sort((left, right) => left.id.localeCompare(right.id));
}

function getSharedCandidateSummary() {
  const result = {};
  for (const market of ["MX", "CL", "CO", "PE"]) {
    const candidates = getSharedCandidatesByMarket(market);
    result[market] = {
      count: candidates.length,
      ids: candidates.map(({ id }) => id),
    };
  }
  return result;
}

module.exports = { getSharedCandidateSummary, getSharedCandidatesByMarket };
