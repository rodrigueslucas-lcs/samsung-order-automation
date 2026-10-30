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
test('EPP rejects mismatched PDP/SKU and PLP routes outside its programme', () => {
  assert.throws(() => getEppConfig('MX', { MX_EPP_QST_SKU:'OTHER' }), /same product/);
  assert.throws(() => getEppConfig('MX', { MX_EPP_QST_PLP_URL:'https://stg2.shop.samsung.com/mx/c/phones' }), /configured staging multistore/);
  const cfg = getEppConfig('MX', { MX_EPP_QST_PLP_URL:'https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/c/phones' });
  assert.match(cfg.plpUrl.pathname,/pymesmx\/c\/phones$/);
});

for (const market of ["MX", "CO", "PE", "CL"]) {
  test(`${market} rejects production, wrong environment and foreign multistore overrides`, () => {
    const base = getEppConfig(market, {});
    for (const host of ["shop.samsung.com", "stg.shop.samsung.com", "stg2.shop.samsung.com.evil.example"]) {
      const url = new URL(base.entryUrl);
      url.hostname = host;
      assert.throws(() => getEppConfig(market, { [`${market}_EPP_STOREFRONT_URL`]: url.href }), /staging host/);
    }
    assert.throws(() => getEppConfig(market, { [`${market}_EPP_QST_PDP_URL`]: `${base.rootUrl.origin}/${market.toLowerCase()}/multistore/other/other/p/SKU` }), /configured staging multistore/);
    assert.throws(() => getEppConfig(market, { [`${market}_EPP_QST_PDP_URL`]: base.rootUrl.href }), /configured staging multistore/);
    assert.throws(() => getEppConfig(market, { [`${market}_EPP_QST_PDP_URL`]: base.rootUrl.href.replace("https:", "http:") + "p/SKU" }), /configured staging multistore/);
  });
}

for (const [market, environments] of Object.entries(expected)) {
  for (const [environment, [host, rootPath, verificationCode, accessMode]] of Object.entries(environments)) {
    test(`${market} ${environment} EPP config keeps the supplied official staging route and access model`, () => {
      const config = getEppConfig(market, { [`${market}_QST_ENVIRONMENT`]: environment, EPP_PROGRAM: rootPath.split("/")[3] });
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

  const co = getEppConfig("CO", { CO_QST_ENVIRONMENT: "S2", EPP_PROGRAM:"co_epp_agre" });
  assert.equal(co.sku, "QN85QN85DBKXZL");
  assert.match(co.pdpUrl.pathname, /\/p\/QN85QN85DBKXZL$/i);
});
