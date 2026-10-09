const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PAYMENT_MARKET_PROFILES,
  getPaymentMarketProfile,
  matchOrderCode,
} = require("../../utils/paymentMarketProfile");

test("payment market profiles define the current MX, PE, CO and CL capture conventions", () => {
  assert.deepEqual(Object.keys(PAYMENT_MARKET_PROFILES).sort(), ["CL", "CO", "MX", "PE"]);
  assert.equal(getPaymentMarketProfile("mx").cartPath, "/mx/cart");
  assert.equal(getPaymentMarketProfile("PE").cartPath, "/pe/cart");
  assert.equal(getPaymentMarketProfile("cl").cartPath, "/cl/cart");
  assert.equal(getPaymentMarketProfile("CO").cartPath, "/co/cart");
});

test("MX order capture accepts the proven MX order-code shape and rejects PE", () => {
  assert.equal(matchOrderCode("MX", "Order MX260908-63926930 confirmed"), "MX260908-63926930");
  assert.equal(matchOrderCode("MX", "Order PE260908-63926930 confirmed"), null);
});

test("PE order capture accepts the existing PE order-code shape and rejects MX", () => {
  assert.equal(matchOrderCode("PE", "Order PE260908-63926930 confirmed"), "PE260908-63926930");
  assert.equal(matchOrderCode("PE", "Order MX260908-63926930 confirmed"), null);
});

for (const market of ["CL", "CO"]) {
  test(`${market} order capture accepts its own order codes and rejects other markets`, () => {
    const profile = getPaymentMarketProfile(market);
    const orderCode = `${market}261008-78229903`;
    assert.ok(profile.orderCodePattern.test(orderCode));
    assert.equal(matchOrderCode(market, `Order ${orderCode} confirmed`), orderCode);
    assert.equal(matchOrderCode(market, `Order ${orderCode}_261009163827713 confirmed`), `${orderCode}_261009163827713`);
    for (const other of ["MX", "PE", "CL", "CO"].filter(code => code !== market)) {
      assert.equal(matchOrderCode(market, `${other}261008-78229903`), null);
    }
    assert.equal(matchOrderCode(market, `${market}261008-123`), null);
  });
}

test("unknown markets fail closed instead of inheriting supported market assumptions", () => {
  assert.throws(
    () => getPaymentMarketProfile("BR"),
    /Unsupported payment market: BR/
  );
  assert.throws(
    () => getPaymentMarketProfile(""),
    /Unsupported payment market: missing/
  );
});
