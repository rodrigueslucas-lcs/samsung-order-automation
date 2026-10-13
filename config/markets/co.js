function targetEnvironment(environment = process.env) {
  const value = String(environment.CO_QST_ENVIRONMENT || environment.ENVIRONMENT || "S2").toUpperCase();
  if (!["S1", "S2"].includes(value)) throw new Error(`Unsupported CO QST environment: ${value}.`);
  return value;
}

function httpsUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}

// Controlled CO Base Store product used as the default candidate in both staging
// environments. Environment-specific overrides remain supported when an S1/S2
// catalog differs: CO_QST_SKU and/or CO_QST_PDP_URL.
const DEFAULT_CO_QST_SKU = "RF32CG5910B1CO";

function getCoQstConfig(environment = process.env) {
  const envName = targetEnvironment(environment);
  const defaultBase = envName === "S2"
    ? "https://stg2.shop.samsung.com/co/"
    : "https://stg.shop.samsung.com/co/";
  const baseUrl = httpsUrl(environment.CO_STOREFRONT_URL || defaultBase, "CO_STOREFRONT_URL");
  if (baseUrl.pathname.replace(/\/+$/, "") !== "/co") {
    throw new Error("CO_STOREFRONT_URL must point to /co/.");
  }

  const setupUrl = envName === "S2" ? new URL("/getcookie.html", baseUrl.origin) : null;
  const sku = String(environment.CO_QST_SKU || DEFAULT_CO_QST_SKU).trim();
  if (!sku) throw new Error(`CO_QST_SKU is required for CO ${envName} Base Store execution.`);

  const pdpUrl = environment.CO_QST_PDP_URL
    ? httpsUrl(environment.CO_QST_PDP_URL, "CO_QST_PDP_URL")
    : new URL(`/co/p/${sku}`, baseUrl);
  if (pdpUrl.hostname !== baseUrl.hostname || !pdpUrl.pathname.startsWith("/co/")) {
    throw new Error("CO_QST_PDP_URL must stay inside the CO storefront.");
  }

  return Object.freeze({
    market: "CO",
    environment: envName,
    environmentLabel: envName === "S2" ? "S2/STG2" : "S1/STG",
    locale: "es-CO",
    currency: "COP",
    baseUrl,
    setupUrl,
    sku,
    pdpUrl,
    cartUrl: new URL("/co/cart", baseUrl),
  });
}

module.exports = { DEFAULT_CO_QST_SKU, getCoQstConfig, targetEnvironment };
