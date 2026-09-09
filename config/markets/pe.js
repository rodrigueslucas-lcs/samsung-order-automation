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

function getPeS1QstConfig(environment = process.env) {
  const baseUrl = assertPeRoute(
    requireHttpsUrl(environment.PE_STOREFRONT_URL, "PE_STOREFRONT_URL"),
    "PE_STOREFRONT_URL"
  );
  const setupUrl = optionalHttpsUrl(environment.PE_SETUP_URL, "PE_SETUP_URL");
  const sku = String(environment.PE_QST_SKU || "").trim() || null;
  const pdpUrl = optionalHttpsUrl(environment.PE_QST_PDP_URL, "PE_QST_PDP_URL");

  if (pdpUrl && pdpUrl.hostname !== baseUrl.hostname) {
    throw new Error("PE_QST_PDP_URL must use the same host as PE_STOREFRONT_URL.");
  }
  if (pdpUrl && !pdpUrl.pathname.startsWith("/pe/")) {
    throw new Error("PE_QST_PDP_URL must stay inside the /pe/ storefront route.");
  }

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
  });
}

module.exports = { getPeS1QstConfig };
