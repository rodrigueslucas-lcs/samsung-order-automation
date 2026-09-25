function targetEnvironment(environment = process.env) {
  const value = String(environment.PE_QST_ENVIRONMENT || environment.ENVIRONMENT || "S1").toUpperCase();
  if (!["S1", "S2"].includes(value)) throw new Error(`Unsupported PE QST environment: ${value}.`);
  return value;
}

function requireHttpsUrl(value, name, envName) {
  if (!value) throw new Error(`${name} is required for PE ${envName} QST automation.`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}

function optionalHttpsUrl(value, name, envName) {
  if (!value) return null;
  return requireHttpsUrl(value, name, envName);
}

function assertPeRoute(url, name) {
  const normalized = url.pathname.replace(/\/+$/, "");
  if (normalized !== "/pe") throw new Error(`${name} must point to the PE storefront root (/pe/).`);
  return url;
}

function assertAddressApi(url) {
  if (!url) return null;
  if (!/\/users\/current\/addresses$/.test(url.pathname)) {
    throw new Error("PE_ADDRESS_API_URL must end in /users/current/addresses.");
  }
  return url;
}

const PROVEN_PE_QST_ST2_SKU = "SM-F741BLBKPEO";

function getPeQstConfig(environment = process.env) {
  const envName = targetEnvironment(environment);
  const defaultBase = envName === "S2"
    ? "https://stg2.shop.samsung.com/pe/"
    : "https://stg.shop.samsung.com/pe/";
  const baseUrl = assertPeRoute(
    requireHttpsUrl(environment.PE_STOREFRONT_URL || defaultBase, "PE_STOREFRONT_URL", envName),
    "PE_STOREFRONT_URL"
  );
  const setupUrl = optionalHttpsUrl(environment.PE_SETUP_URL, "PE_SETUP_URL", envName);
  if (setupUrl && setupUrl.hostname !== baseUrl.hostname) {
    throw new Error("PE_SETUP_URL must use the same host as PE_STOREFRONT_URL.");
  }

  const sku = String(environment.PE_QST_SKU || PROVEN_PE_QST_ST2_SKU).trim();
  const pdpUrl =
    optionalHttpsUrl(environment.PE_QST_PDP_URL, "PE_QST_PDP_URL", envName) ||
    new URL(`/pe/p/${sku}`, baseUrl.origin);

  if (pdpUrl.hostname !== baseUrl.hostname) {
    throw new Error("PE_QST_PDP_URL must use the same host as PE_STOREFRONT_URL.");
  }
  if (!pdpUrl.pathname.startsWith("/pe/")) {
    throw new Error("PE_QST_PDP_URL must stay inside the /pe/ storefront route.");
  }

  const addressApiUrl = assertAddressApi(
    optionalHttpsUrl(environment.PE_ADDRESS_API_URL, "PE_ADDRESS_API_URL", envName)
  );

  return Object.freeze({
    market: "PE",
    environment: envName,
    environmentLabel: envName === "S2" ? "S2/STG2" : "S1/STG",
    locale: "es-PE",
    currency: "PEN",
    baseUrl,
    setupUrl,
    sku,
    pdpUrl,
    cartUrl: new URL("/pe/cart", baseUrl),
    addressApiUrl,
  });
}

module.exports = { PROVEN_PE_QST_ST2_SKU, getPeQstConfig, targetEnvironment };
