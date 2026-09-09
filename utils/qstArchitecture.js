const smbMapping = require("../test-mapping/smb-qst.json");
const sharedCore = require("../test-mapping/smb-shared-core-families.json");

const MARKETS = Object.freeze(["MX", "CL", "CO", "PE"]);

function validateSharedCoreFamilies() {
  const errors = [];
  const families = sharedCore.families || [];

  if (sharedCore.familyCount !== families.length) {
    errors.push(
      `familyCount: declared ${sharedCore.familyCount}, actual ${families.length}`
    );
  }

  const names = families.map(({ family }) => family);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    errors.push(`duplicate families: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  for (const family of families) {
    if (!family.family || !family.feature) {
      errors.push("every shared-core family requires family and feature");
      continue;
    }

    const populatedMarkets = [];
    for (const market of MARKETS) {
      const ids = family.ids?.[market] || [];
      if (ids.length) populatedMarkets.push(market);

      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length) {
        errors.push(
          `${family.family}/${market}: duplicate IDs ${[...new Set(duplicates)].join(", ")}`
        );
      }

      for (const id of ids) {
        if (!smbMapping.markets?.[market]?.cases?.includes(id)) {
          errors.push(`${family.family}/${market}: unknown official ID ${id}`);
        }
      }
    }

    const declaredMarkets = family.markets || [];
    const missingMarket = populatedMarkets.filter((market) => !declaredMarkets.includes(market));
    const extraMarket = declaredMarkets.filter((market) => !populatedMarkets.includes(market));
    if (missingMarket.length || extraMarket.length) {
      errors.push(
        `${family.family}: markets mismatch; ids=${populatedMarkets.join(",")}, declared=${declaredMarkets.join(",")}`
      );
    }

    if (family.marketCount !== populatedMarkets.length) {
      errors.push(
        `${family.family}: marketCount ${family.marketCount} does not match ${populatedMarkets.length}`
      );
    }
  }

  if (errors.length) {
    throw new Error(`Invalid SMB shared-core architecture mapping:\n${errors.join("\n")}`);
  }

  return { familyCount: families.length };
}

module.exports = { MARKETS, validateSharedCoreFamilies };
