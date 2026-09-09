const PREQA2_HOST = "p6-pre-qa2.samsung.com";
const PREQA2_MARKETS = Object.freeze(["mx", "cl", "co", "pe"]);

function parsePreqa2Url(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== PREQA2_HOST) {
    throw new Error(`${name} must use the Samsung WMC PreQA2 host ${PREQA2_HOST}.`);
  }
  return url;
}

function normalizePreqa2Market(value) {
  const market = String(value || "").trim().toLowerCase();
  if (!PREQA2_MARKETS.includes(market)) {
    throw new Error(`PREQA2_MARKET must be one of: ${PREQA2_MARKETS.join(", ")}.`);
  }
  return market;
}

function getPreqa2Config(environment = process.env) {
  const market = normalizePreqa2Market(environment.PREQA2_MARKET || "mx");
  const origin = parsePreqa2Url(
    environment.PREQA2_BASE_URL || `https://${PREQA2_HOST}/`,
    "PREQA2_BASE_URL"
  ).origin;

  return {
    environment: "PREQA2",
    hostname: PREQA2_HOST,
    market: market.toUpperCase(),
    sitesUrl: parsePreqa2Url(`${origin}/sites/`, "PreQA2 sites URL"),
    bootstrapUrl: parsePreqa2Url(`${origin}/getcookies`, "PreQA2 bootstrap URL"),
    storefrontUrl: parsePreqa2Url(`${origin}/${market}/`, "PreQA2 storefront URL"),
  };
}

module.exports = {
  PREQA2_HOST,
  PREQA2_MARKETS,
  getPreqa2Config,
  normalizePreqa2Market,
  parsePreqa2Url,
};
