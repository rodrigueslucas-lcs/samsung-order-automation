function targetEnvironment(environment = process.env) {
  const value = String(environment.CL_QST_ENVIRONMENT || environment.ENVIRONMENT || "S2").toUpperCase();
  if (!["S1", "S2"].includes(value)) throw new Error(`Unsupported CL QST environment: ${value}.`);
  return value;
}

function httpsUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}

function getClQstConfig(environment = process.env) {
  const envName = targetEnvironment(environment);
  const defaultBase = envName === "S2"
    ? "https://stg2.shop.samsung.com/cl/"
    : "https://stg.shop.samsung.com/cl/";
  const baseUrl = httpsUrl(environment.CL_STOREFRONT_URL || defaultBase, "CL_STOREFRONT_URL");
  if (baseUrl.pathname.replace(/\/+$/, "") !== "/cl") throw new Error("CL_STOREFRONT_URL must point to /cl/.");

  const setupUrl = envName === "S2" ? new URL("/getcookie.html", baseUrl.origin) : null;

  // Verified Chile Base Store product supplied for QST stabilization.
  // Any CL scenario that only needs a generic sellable product must use this
  // default instead of borrowing product data from another LATAM market.
  const defaultSku = "SM-S918BZKILTL";
  const sku = String(environment.CL_QST_SKU || defaultSku).trim();
  const pdpUrl = environment.CL_QST_PDP_URL
    ? httpsUrl(environment.CL_QST_PDP_URL, "CL_QST_PDP_URL")
    : new URL(`/cl/p/${sku}`, baseUrl);
  if (pdpUrl.hostname !== baseUrl.hostname || !pdpUrl.pathname.startsWith("/cl/")) {
    throw new Error("CL_QST_PDP_URL must stay inside the CL storefront.");
  }

  const eppUrl = environment.CL_EPP_STOREFRONT_URL
    ? httpsUrl(environment.CL_EPP_STOREFRONT_URL, "CL_EPP_STOREFRONT_URL")
    : null;

  return Object.freeze({
    market: "CL",
    environment: envName,
    environmentLabel: envName === "S2" ? "S2/STG2" : "S1/STG",
    locale: "es-CL",
    currency: "CLP",
    baseUrl,
    setupUrl,
    sku,
    pdpUrl,
    cartUrl: new URL("/cl/cart", baseUrl),
    eppUrl,
  });
}

module.exports = { getClQstConfig, targetEnvironment };
