const mxConfigModule = require("../../utils/mxConfig");

const { getMxConfig } = mxConfigModule;

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

  // CL/CO/PE are intentionally env-driven until each market is validated live.
  // This avoids baking unverified staging hosts, routes, SKUs or test data into the framework.
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
