const MX_ENVIRONMENTS = Object.freeze({
  S1: { hostname: "stg.shop.samsung.com", storefrontLabel: "S1/STG" },
  S2: { hostname: "stg2.shop.samsung.com", storefrontLabel: "S2/STG2" },
});

function resolveMxEnvironment(environment = process.env) {
  const target = String(environment.MX_QST_ENVIRONMENT || environment.ENVIRONMENT || "S1").toUpperCase();
  const config = MX_ENVIRONMENTS[target];
  if (!config) throw new Error(`Unsupported MX QST environment: ${target}. Use S1 or S2.`);
  return { name: target, ...config };
}

function parseMxUrl(value, name, target = resolveMxEnvironment()) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== target.hostname) {
    throw new Error(`${name} must use the MX ${target.name} staging host ${target.hostname}.`);
  }
  return url;
}

function getMxConfig(environment = process.env) {
  const target = resolveMxEnvironment(environment);
  const baseUrl = parseMxUrl(
    environment.MX_STOREFRONT_URL || `https://${target.hostname}/mx/`,
    "MX_STOREFRONT_URL",
    target
  );
  const bootstrapUrl = parseMxUrl(
    environment.MX_BOOTSTRAP_URL || `https://${target.hostname}/getcookie.html`,
    "MX_BOOTSTRAP_URL",
    target
  );
  const sku = environment.MX_SMOKE_SKU || "WD26DB8995BZAX";
  const pdpUrl = parseMxUrl(
    environment.MX_SMOKE_PDP_URL || `${baseUrl.origin}/mx/p/${sku}`,
    "MX_SMOKE_PDP_URL",
    target
  );
  const cartUrl = parseMxUrl(
    environment.MX_CART_URL || `${baseUrl.origin}/mx/cart`,
    "MX_CART_URL",
    target
  );

  return {
    country: "MX",
    environment: target.name,
    environmentLabel: target.storefrontLabel,
    hostname: target.hostname,
    currency: "MXN",
    routePrefix: "/mx/",
    baseUrl,
    bootstrapUrl,
    pdpUrl,
    cartUrl,
    sku,
  };
}

const MX_HOST = MX_ENVIRONMENTS.S1.hostname;
module.exports = { MX_HOST, MX_ENVIRONMENTS, resolveMxEnvironment, getMxConfig, parseMxUrl };