const test = require("node:test");
const assert = require("node:assert/strict");
const { getEppConfig } = require("../../config/markets/epp");

const expected = {
  MX: {
    S1: ["stg.shop.samsung.com", "/mx/multistore/mxtotalplay/mxtotalplay/", "12345", "verification-code"],
    S2: ["stg2.shop.samsung.com", "/mx/multistore/pymesmx/pymesmx/", "12345", "verification-code"],
  },
  CO: {
    S1: ["stg.shop.samsung.com", "/co/multistore/colaboradores_co/colaboradores_co/", "12345", "verification-code"],
    S2: ["stg2.shop.samsung.com", "/co/multistore/co_epp_agre/co_epp_agre/", null, "corporate-email-link"],
  },
  PE: {
    S1: ["stg.shop.samsung.com", "/pe/multistore/beneficios_empleados/beneficios_empleados/", "JET85", "verification-code"],
    S2: ["stg2.shop.samsung.com", "/pe/multistore/beneficios_empleados/beneficios_empleados/", "JET85", "verification-code"],
  },
  CL: {
    S1: ["stg.shop.samsung.com", "/cl/multistore/alianzas/alianzas/", "JET85", "verification-code"],
    S2: ["stg2.shop.samsung.com", "/cl/multistore/alianzas/alianzas/", "JET85", "verification-code"],
  },
};

for (const [market, environments] of Object.entries(expected)) {
  for (const [environment, [host, rootPath, verificationCode, accessMode]] of Object.entries(environments)) {
    test(`${market} ${environment} EPP config keeps the supplied official staging route and access model`, () => {
      const config = getEppConfig(market, { [`${market}_QST_ENVIRONMENT`]: environment });
      assert.equal(config.rootUrl.hostname, host);
      assert.equal(config.rootUrl.pathname, rootPath);
      assert.equal(config.verificationCode, verificationCode);
      assert.equal(config.accessMode, accessMode);
      assert.equal(config.cartUrl.href, `${config.rootUrl.href}cart`);
    });
  }
}

test("MX S2 and CO S2 derive PDP/SKU directly from the supplied official EPP test URLs", () => {
  const mx = getEppConfig("MX", { MX_QST_ENVIRONMENT: "S2" });
  assert.equal(mx.sku, "SM-F741BLBKLTM");
  assert.match(mx.pdpUrl.pathname, /\/p\/SM-F741BLBKLTM$/i);

  const co = getEppConfig("CO", { CO_QST_ENVIRONMENT: "S2" });
  assert.equal(co.sku, "QN85QN85DBKXZL");
  assert.match(co.pdpUrl.pathname, /\/p\/QN85QN85DBKXZL$/i);
});
