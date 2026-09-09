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

function assertMarketRoot(url, code, name) {
  const expected = `/${code.toLowerCase()}`;
  const normalized = url.pathname.replace(/\/+$/, "").toLowerCase();
  if (normalized !== expected) {
    throw new Error(`${name} must point to the ${code} storefront root (${expected}/).`);
  }
  return url;
}

function getMarketConfig(value, environment = process.env) {
  const code = normalizeMarketCode(value);
  const definition = getMarketDefinition(code);

  if (code === "MX") {
    return {
      ...getMxConfig(environment),
      ...definition,
      market: code,
    };
  }

  if (code === "PE") {
    return {
      ...getPeS1QstConfig(environment),
      ...definition,
      market: code,
    };
  }

  const variable = `${code}_STOREFRONT_URL`;
  const rawBaseUrl = environment[variable];
  if (!rawBaseUrl) {
    throw new Error(`${variable} is required before running ${code} storefront automation.`);
  }

  return {
    ...definition,
    market: code,
    environment: "S1",
    baseUrl: assertMarketRoot(parseStagingUrl(rawBaseUrl, variable), code, variable),
  };
}

module.exports = {
  MARKET_DEFINITIONS,
  getMarketConfig,
  getMarketDefinition,
  normalizeMarketCode,
};
