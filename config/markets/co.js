function targetEnvironment(environment = process.env) {
  const value = String(environment.CO_QST_ENVIRONMENT || environment.ENVIRONMENT || "S2").toUpperCase();
  if (!["S1", "S2"].includes(value)) throw new Error(`Unsupported CO QST environment: ${value}.`);
  return value;
}
function httpsUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}
function getCoQstConfig(environment = process.env) {
  const envName = targetEnvironment(environment);
  const defaultBase = envName === "S2" ? "https://stg2.shop.samsung.com/co/" : "https://stg.shop.samsung.com/co/";
  const baseUrl = httpsUrl(environment.CO_STOREFRONT_URL || defaultBase, "CO_STOREFRONT_URL");
  if (baseUrl.pathname.replace(/\/+$/, "") !== "/co") throw new Error("CO_STOREFRONT_URL must point to /co/.");
  const setupUrl = envName === "S2" ? new URL("/getcookie.html", baseUrl.origin) : null;
  const sku = String(environment.CO_QST_SKU || "").trim();
  const pdpUrl = environment.CO_QST_PDP_URL ? httpsUrl(environment.CO_QST_PDP_URL, "CO_QST_PDP_URL") : null;
  if (pdpUrl && (pdpUrl.hostname !== baseUrl.hostname || !pdpUrl.pathname.startsWith("/co/"))) throw new Error("CO_QST_PDP_URL must stay inside the CO storefront.");
  return Object.freeze({ market:"CO", environment:envName, environmentLabel:envName === "S2" ? "S2/STG2" : "S1/STG", locale:"es-CO", currency:"COP", baseUrl, setupUrl, sku, pdpUrl, cartUrl:new URL("/co/cart", baseUrl) });
}
module.exports={getCoQstConfig,targetEnvironment};
