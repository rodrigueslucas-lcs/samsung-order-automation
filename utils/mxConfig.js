const MX_HOST = "stg.shop.samsung.com";

function parseMxUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== MX_HOST) {
    throw new Error(`${name} must use the MX staging host ${MX_HOST}.`);
  }
  return url;
}

function getMxConfig(environment = process.env) {
  const baseUrl = parseMxUrl(
    environment.MX_STOREFRONT_URL || "https://stg.shop.samsung.com/mx/",
    "MX_STOREFRONT_URL"
  );
  const bootstrapUrl = parseMxUrl(
    environment.MX_BOOTSTRAP_URL || "https://stg.shop.samsung.com/getcookie.html",
    "MX_BOOTSTRAP_URL"
  );
  const sku = environment.MX_SMOKE_SKU || "WD26DB8995BZAX";
  const pdpUrl = parseMxUrl(
    environment.MX_SMOKE_PDP_URL || `${baseUrl.origin}/mx/p/${sku}`,
    "MX_SMOKE_PDP_URL"
  );
  const cartUrl = parseMxUrl(
    environment.MX_CART_URL || `${baseUrl.origin}/mx/cart`,
    "MX_CART_URL"
  );

  return {
    country: "MX",
    environment: "S1",
    hostname: MX_HOST,
    currency: "MXN",
    routePrefix: "/mx/",
    baseUrl,
    bootstrapUrl,
    pdpUrl,
    cartUrl,
    sku,
  };
}

module.exports = { MX_HOST, getMxConfig, parseMxUrl };
