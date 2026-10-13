const test = require("node:test");
const assert = require("node:assert/strict");
const { getMxTrackingPrerequisite } = require("../../utils/mxTrackingPrerequisite.cjs");

const order = { market: "mx", environment: "S2", confirmed: true,
  orderNumber: "MX261009-12345678_261009204410628", email: "qa-tracking@mailinator.com", inbox: "qa-tracking" };

test("tracking rejects a saved order from the other environment in both directions", () => {
  assert.equal(getMxTrackingPrerequisite(order, "S1"), null);
  assert.equal(getMxTrackingPrerequisite({ ...order, environment: "S1" }, "S2"), null);
});

test("tracking preserves the full order code and paired inbox for the matching environment", () => {
  for (const environment of ["S1", "S2"]) {
    assert.deepEqual(getMxTrackingPrerequisite({ ...order, environment }, environment), {
      orderNumber: order.orderNumber, email: order.email, inbox: order.inbox,
    });
  }
});

test("tracking fails closed for unscoped, foreign, unconfirmed or mismatched data", () => {
  for (const change of [{ environment: undefined }, { market: undefined }, { market: "CL" },
    { confirmed: false }, { orderNumber: "CL261009-12345678" }, { email: "another@mailinator.com" }]) {
    assert.equal(getMxTrackingPrerequisite({ ...order, ...change }, "S2"), null);
  }
  assert.equal(getMxTrackingPrerequisite(order, "S3"), null);
  assert.equal(getMxTrackingPrerequisite(null, "S1"), null);
});
