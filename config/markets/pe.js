function requireHttpsUrl(value, name) {
  if (!value) throw new Error(`${name} is required for PE S1 QST automation.`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}

function optionalHttpsUrl(value, name) {
  if (!value) return null;
  return requireHttpsUrl(value, name);
}

function assertPeRoute(url, name) {
  const normalized = url.pathname.replace(/\/+$/, "");
  if (normalized !== "/pe") {
    throw new Error(`${name} must point to the PE storefront root (/pe/).`);
  }
  return url;
}

function assertAddressApi(url) {
  if (!url) return null;
  if (!/\/users\/current\/addresses$/.test(url.pathname)) {
    throw new Error("PE_ADDRESS_API_URL must end in /users/current/addresses.");
  }
  return url;
}

const PROVEN_PE_QST_ST2_SKU = "RB45DG6300B1PE";

function getPeS1QstConfig(environment = process.env) {
  const baseUrl = assertPeRoute(
    requireHttpsUrl(environment.PE_STOREFRONT_URL, "PE_STOREFRONT_URL"),
    "PE_STOREFRONT_URL"
  );
  const setupUrl = optionalHttpsUrl(environment.PE_SETUP_URL, "PE_SETUP_URL");
  if (setupUrl && setupUrl.hostname !== baseUrl.hostname) {
    throw new Error("PE_SETUP_URL must use the same host as PE_STOREFRONT_URL.");
  }

  // Proven existing PE ST2 QST product. Runtime env can override it if S1 differs.
  const sku = String(environment.PE_QST_SKU || PROVEN_PE_QST_ST2_SKU).trim();
  const pdpUrl =
    optionalHttpsUrl(environment.PE_QST_PDP_URL, "PE_QST_PDP_URL") ||
    new URL(`/pe/p/${sku}`, baseUrl.origin);

  if (pdpUrl.hostname !== baseUrl.hostname) {
    throw new Error("PE_QST_PDP_URL must use the same host as PE_STOREFRONT_URL.");
  }
  if (!pdpUrl.pathname.startsWith("/pe/")) {
    throw new Error("PE_QST_PDP_URL must stay inside the /pe/ storefront route.");
  }

  const addressApiUrl = assertAddressApi(
    optionalHttpsUrl(environment.PE_ADDRESS_API_URL, "PE_ADDRESS_API_URL")
  );

  return Object.freeze({
    market: "PE",
    environment: "S1",
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

module.exports = { PROVEN_PE_QST_ST2_SKU, getPeS1QstConfig };
