const PAYMENT_MARKET_PROFILES = Object.freeze({
  MX: Object.freeze({
    code: "MX",
    label: "MX",
    orderCodePattern: /\bMX\d{6}-\d{8}(?:_\d+)?\b/i,
    cartPath: "/mx/cart",
    artifactSlug: "mx",
  }),
  PE: Object.freeze({
    code: "PE",
    label: "PE",
    orderCodePattern: /\bPE\d{6}-\d{8}(?:_\d+)?\b/i,
    cartPath: "/pe/cart",
    artifactSlug: "pe",
  }),
});

function getPaymentMarketProfile(market) {
  const code = String(market || "").trim().toUpperCase();
  const profile = PAYMENT_MARKET_PROFILES[code];
  if (!profile) {
    throw new Error(
      `Unsupported payment market: ${market || "missing"}. Add a runtime-proven profile before enabling destructive payment capture.`
    );
  }
  return profile;
}

function matchOrderCode(market, value) {
  const { orderCodePattern } = getPaymentMarketProfile(market);
  return String(value || "").match(orderCodePattern)?.[0] || null;
}

module.exports = {
  PAYMENT_MARKET_PROFILES,
  getPaymentMarketProfile,
  matchOrderCode,
};
