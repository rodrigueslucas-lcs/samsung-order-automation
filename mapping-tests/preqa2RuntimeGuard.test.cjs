const test = require("node:test");
const assert = require("node:assert/strict");
const { assertApprovedPreqa2Url, normalizeMarket } = require("../utils/preqa2RuntimeGuard");

test("runtime guard accepts approved absolute and relative market routes", () => {
  const absolute = assertApprovedPreqa2Url(
    "https://p6-pre-qa2.samsung.com/mx/smartphones/all-smartphones/",
    { market: "MX" }
  );
  const relative = assertApprovedPreqa2Url("/mx/cart", { market: "MX" });
  assert.equal(absolute.pathname, "/mx/smartphones/all-smartphones/");
  assert.equal(relative.href, "https://p6-pre-qa2.samsung.com/mx/cart");
});

test("runtime guard rejects Production, foreign hosts and protocol-relative escapes", () => {
  assert.throws(
    () => assertApprovedPreqa2Url("https://www.samsung.com/mx/smartphones/", { market: "MX" }),
    /left approved host/
  );
  assert.throws(
    () => assertApprovedPreqa2Url("https://stg.shop.samsung.com/mx/", { market: "MX" }),
    /left approved host/
  );
  assert.throws(
    () => assertApprovedPreqa2Url("//www.samsung.com/mx/", { market: "MX" }),
    /left approved host/
  );
});

test("runtime guard rejects cross-market storefront navigation", () => {
  assert.throws(
    () => assertApprovedPreqa2Url("https://p6-pre-qa2.samsung.com/pe/", { market: "MX" }),
    /left MX storefront route/
  );
});

test("infrastructure routes are only accepted when explicitly allowed", () => {
  assert.throws(
    () => assertApprovedPreqa2Url("https://p6-pre-qa2.samsung.com/sites/", { market: "MX" }),
    /left MX storefront route/
  );
  assert.doesNotThrow(() => assertApprovedPreqa2Url(
    "https://p6-pre-qa2.samsung.com/sites/",
    { market: "MX", allowInfrastructurePath: true }
  ));
});

test("market guard validates supported SMB codes", () => {
  assert.equal(normalizeMarket("pe"), "PE");
  assert.throws(() => normalizeMarket("BR"), /Unsupported PreQA2 market guard/);
});
