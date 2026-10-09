const EPP_ACCESS = Object.freeze({
  MX: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/mx/multistore/mxtotalplay/mxtotalplay/",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/p/SM-F741BLBKLTM",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: "SM-F741BLBKLTM",
    }),
  }),
  CO: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/co/multistore/colaboradores_co/colaboradores_co/",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/p/QN85QN85DBKXZL",
      verificationCode: null,
      accessMode: "corporate-email-link",
      sku: "QN85QN85DBKXZL",
      note: "Enter a corporate email ID, activate the profile from the email link, then re-launch the EPP URL.",
    }),
  }),
  PE: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/pe/multistore/beneficios_empleados/beneficios_empleados/auth/multistore",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/pe/multistore/beneficios_empleados/beneficios_empleados/",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
  }),
  CL: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
  }),
});

function normalizeEnvironment(value) {
  const environment = String(value || "S2").trim().toUpperCase();
  if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported EPP environment: ${environment}.`);
  return environment;
}

function inferMultistoreRoot(url) {
  const pathname = url.pathname;
  const pdpMarker = pathname.toLowerCase().indexOf("/p/");
  const rootPath = pdpMarker >= 0 ? pathname.slice(0, pdpMarker + 1) : pathname.replace(/auth\/multistore\/?$/i, "");
  return new URL(rootPath.endsWith("/") ? rootPath : `${rootPath}/`, url.origin);
}

function getEppConfig(market, environment = process.env) {
  const code = String(market || "").trim().toUpperCase();
  if (!EPP_ACCESS[code]) throw new Error(`Unsupported EPP market: ${market}.`);
  const envName = normalizeEnvironment(
    environment[`${code}_QST_ENVIRONMENT`] || environment.ENVIRONMENT || "S2"
  );
  const source = EPP_ACCESS[code][envName];
  const override = String(environment[`${code}_EPP_STOREFRONT_URL`] || "").trim();
  const entryUrl = new URL(override || source.storefrontUrl);
  if (entryUrl.protocol !== "https:") throw new Error(`${code} EPP storefront must use https.`);
  if (!entryUrl.pathname.toLowerCase().startsWith(`/${code.toLowerCase()}/multistore/`)) {
    throw new Error(`${code} EPP storefront must stay inside /${code.toLowerCase()}/multistore/.`);
  }
  const rootUrl = inferMultistoreRoot(entryUrl);
  const explicitPdp = String(environment[`${code}_EPP_QST_PDP_URL`] || "").trim();
  const pdpUrl = explicitPdp ? new URL(explicitPdp) : (/\/p\//i.test(entryUrl.pathname) ? entryUrl : null);
  const sku = String(environment[`${code}_EPP_QST_SKU`] || source.sku || "").trim() || null;
  if (pdpUrl && (pdpUrl.hostname !== rootUrl.hostname || !pdpUrl.pathname.toLowerCase().startsWith(`/${code.toLowerCase()}/multistore/`))) {
    throw new Error(`${code} EPP PDP must stay on the configured staging multistore.`);
  }
  return Object.freeze({
    market: code,
    environment: envName,
    environmentLabel: envName === "S2" ? "S2/STG2" : "S1/STG",
    entryUrl,
    rootUrl,
    pdpUrl,
    sku,
    cartUrl: new URL("cart", rootUrl),
    verificationCode: source.verificationCode,
    accessMode: source.accessMode,
    note: source.note || null,
  });
}

module.exports = { EPP_ACCESS, getEppConfig, inferMultistoreRoot, normalizeEnvironment };
