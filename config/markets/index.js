const mxConfigModule = require("../../utils/mxConfig");
const peConfigModule = require("./pe");

const { getMxConfig } = mxConfigModule;
const { getPeS1QstConfig } = peConfigModule;

const MARKET_DEFINITIONS = Object.freeze({
  MX: Object.freeze({ code: "MX", locale: "es-MX", currency: "MXN" }),
  CL: Object.freeze({ code: "CL", locale: "es-CL", currency: "CLP" }),
  CO: Object.freeze({ code: "CO", locale: "es-CO", currency: "COP" }),
  PE: Object.freeze({ code: "PE", locale: "es-PE", currency: "PEN" }),
});

function normalizeMarketCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!MARKET_DEFINITIONS[code]) {
    throw new Error(`Unsupported SMB market: ${value}`);
  }
  return code;
}

function getMarketDefinition(value) {
  return MARKET_DEFINITIONS[normalizeMarketCode(value)];
}

function parseStagingUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https.`);
  }
  return url;
}

function getMarketConfig(value, environment = process.env) {
  const code = normalizeMarketCode(value);
  const definition = getMarketDefinition(code);

  // Preserve the already-proven MX configuration while the shared SMB layer is introduced.
  if (code === "MX") {
    return {
      ...getMxConfig(environment),
      ...definition,
      market: code,
    };
  }

  // PE now has an explicit S1 QST config because there is substantial ST2 automation to reuse.
  // It remains runtime-driven: no unverified S1 host, SKU or PDP is baked into the framework.
  if (code === "PE") {
    return {
      ...getPeS1QstConfig(environment),
      ...definition,
      market: code,
    };
  }

  // CL/CO remain env-driven until each market is validated live.
  const variable = `${code}_STOREFRONT_URL`;
  const rawBaseUrl = environment[variable];
  if (!rawBaseUrl) {
    throw new Error(`${variable} is required before running ${code} storefront automation.`);
  }

  return {
    ...definition,
    market: code,
    environment: "S1",
    baseUrl: parseStagingUrl(rawBaseUrl, variable),
  };
}

module.exports = {
  MARKET_DEFINITIONS,
  getMarketConfig,
  getMarketDefinition,
  normalizeMarketCode,
};
