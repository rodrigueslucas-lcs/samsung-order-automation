const sharedCore = require("../governance/smb-shared-core-families.json");

function runtimeEnvironment(code, explicit) {
  const marketEnv = process.env[`${code}_QST_ENVIRONMENT`];
  const value = String(explicit || marketEnv || process.env.TEST_ENV || "S1").toUpperCase();
  return value.includes("S2") || value.includes("STG2") ? "S2" : "S1";
}

function getSharedQstEvidenceMetadata(market, zephyrId, options = {}) {
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
    environment: runtimeEnvironment(code, options.environment),
    sharedFamily: family.family,
  };
}

module.exports = { getSharedQstEvidenceMetadata };
