const PRODUCTION_HOSTS = new Set([
  "www.samsung.com",
  "samsung.com",
  "shop.samsung.com",
]);

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function resolveEppConfig(environment = process.env) {
  const rawUrl = environment.EPP_STOREFRONT_URL;
  if (!rawUrl) {
    return {
      configured: false,
      missing: ["EPP_STOREFRONT_URL"],
      siteUid: environment.EPP_SITE_UID || null,
      baseStoreUid: environment.EPP_BASE_STORE_UID || null,
      smokeSku: environment.EPP_SMOKE_SKU || null,
    };
  }

  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  const explicitHosts = new Set(parseList(environment.EPP_STAGING_HOST_ALLOWLIST));
  const looksLikeStaging = /(?:stg|stage|staging|model-t)/i.test(hostname);

  if (url.protocol !== "https:") {
    throw new Error("EPP_STOREFRONT_URL must use HTTPS.");
  }
  if (PRODUCTION_HOSTS.has(hostname)) {
    throw new Error(`Refusing Production EPP host: ${hostname}`);
  }
  if (!looksLikeStaging && !explicitHosts.has(hostname)) {
    throw new Error(
      `Unverified EPP host ${hostname}. Supply a staging-like host or explicitly allow it with EPP_STAGING_HOST_ALLOWLIST.`
    );
  }

  const optionalUrls = Object.fromEntries(
    [
      ["smokePdpUrl", "EPP_SMOKE_PDP_URL"],
      ["cartUrl", "EPP_CART_URL"],
      ["accountUrl", "EPP_ACCOUNT_URL"],
      ["ordersUrl", "EPP_ORDERS_URL"],
    ].map(([key, variable]) => {
      if (!environment[variable]) return [key, null];
      const candidate = new URL(environment[variable]);
      if (candidate.protocol !== "https:" || candidate.hostname.toLowerCase() !== hostname) {
        throw new Error(`${variable} must use HTTPS and the configured EPP storefront host.`);
      }
      return [key, candidate];
    })
  );

  return {
    configured: true,
    url,
    origin: url.origin,
    hostname,
    siteUid: environment.EPP_SITE_UID || null,
    baseStoreUid: environment.EPP_BASE_STORE_UID || null,
    smokeSku: environment.EPP_SMOKE_SKU || null,
    ...optionalUrls,
  };
}

function requireEppEnvironment(environment = process.env) {
  const config = resolveEppConfig(environment);
  if (!config.configured) {
    throw new Error("EPP environment is not configured. Set EPP_STOREFRONT_URL.");
  }
  return config;
}

function requireEppSmokeProduct(environment = process.env) {
  const config = requireEppEnvironment(environment);
  const missing = [];
  if (!config.smokeSku) missing.push("EPP_SMOKE_SKU");
  if (!config.smokePdpUrl) missing.push("EPP_SMOKE_PDP_URL");
  if (!config.cartUrl) missing.push("EPP_CART_URL");
  if (missing.length) throw new Error(`Missing EPP smoke product configuration: ${missing.join(", ")}.`);
  return config;
}

module.exports = {
  resolveEppConfig,
  requireEppEnvironment,
  requireEppSmokeProduct,
};
