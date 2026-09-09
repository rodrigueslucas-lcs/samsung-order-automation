const sharedCore = require("../test-mapping/smb-shared-core-families.json");

function getSharedQstEvidenceMetadata(market, zephyrId) {
  const code = String(market || "").trim().toUpperCase();
  const matches = [];

  for (const family of sharedCore.families || []) {
    if ((family.ids?.[code] || []).includes(zephyrId)) {
      matches.push(family);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Shared QST evidence metadata expected exactly one ${code}/${zephyrId} family, found ${matches.length}.`
    );
  }

  const family = matches[0];
  return {
    zephyrId,
    market: code,
    suite: "QST",
    feature: family.feature,
    environment: "S1",
    sharedFamily: family.family,
  };
}

module.exports = { getSharedQstEvidenceMetadata };
