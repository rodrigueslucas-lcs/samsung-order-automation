const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PAYMENT_MARKET_PROFILES,
  getPaymentMarketProfile,
  matchOrderCode,
} = require("../utils/paymentMarketProfile");

test("payment market profiles contain only runtime-proven MX and PE capture conventions", () => {
  assert.deepEqual(Object.keys(PAYMENT_MARKET_PROFILES).sort(), ["MX", "PE"]);
  assert.equal(getPaymentMarketProfile("mx").cartPath, "/mx/cart");
  assert.equal(getPaymentMarketProfile("PE").cartPath, "/pe/cart");
});

test("MX order capture accepts the proven MX order-code shape and rejects PE", () => {
  assert.equal(matchOrderCode("MX", "Order MX260908-63926930 confirmed"), "MX260908-63926930");
  assert.equal(matchOrderCode("MX", "Order PE260908-63926930 confirmed"), null);
});

test("PE order capture accepts the existing PE order-code shape and rejects MX", () => {
  assert.equal(matchOrderCode("PE", "Order PE260908-63926930 confirmed"), "PE260908-63926930");
  assert.equal(matchOrderCode("PE", "Order MX260908-63926930 confirmed"), null);
});

test("unknown markets fail closed instead of inheriting MX or PE destructive assumptions", () => {
  assert.throws(
    () => getPaymentMarketProfile("CL"),
    /Unsupported payment market: CL/
  );
  assert.throws(
    () => getPaymentMarketProfile("CO"),
    /Unsupported payment market: CO/
  );
});
