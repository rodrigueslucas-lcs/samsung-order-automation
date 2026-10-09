const mxConfigModule = require("../../utils/mxConfig");
const peConfigModule = require("./pe");
const coConfigModule = require("./co");
const clConfigModule = require("./cl");

const { getMxConfig } = mxConfigModule;
const { getPeQstConfig } = peConfigModule;
const { getCoQstConfig } = coConfigModule;
const { getClQstConfig } = clConfigModule;

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

function getMarketConfig(value, environment = process.env) {
  const code = normalizeMarketCode(value);
  const definition = getMarketDefinition(code);

  if (code === "MX") {
    return { ...getMxConfig(environment), ...definition, market: code };
  }
  if (code === "CL") {
    return { ...getClQstConfig(environment), ...definition, market: code };
  }
  if (code === "CO") {
    return { ...getCoQstConfig(environment), ...definition, market: code };
  }
  if (code === "PE") {
    return { ...getPeQstConfig(environment), ...definition, market: code };
  }

  throw new Error(`Unsupported SMB market: ${code}`);
}

module.exports = {
  MARKET_DEFINITIONS,
  getMarketConfig,
  getMarketDefinition,
  normalizeMarketCode,
};
