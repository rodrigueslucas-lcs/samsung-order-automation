import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
export async function bootstrapCoStorefront(page, config) {
  if (!config.setupUrl) return;
  await page.goto(config.setupUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByText(/you can access pages now/i).waitFor({state:"visible",timeout:30000});
}
async function resolveProduct(page,config){
  if(config.pdpUrl&&config.sku)return{pdpUrl:config.pdpUrl,sku:config.sku};
  await bootstrapCoStorefront(page,config);
  await page.goto(config.baseUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  const href=await page.locator('a[href*="/co/p/"]').evaluateAll((links)=>links.map(a=>a.href).find(Boolean)||null);
  if(!href)throw new Error("No CO PDP link was discoverable from the storefront. Set CO_QST_PDP_URL and CO_QST_SKU to a verified Colombia product.");
  const pdpUrl=new URL(href); const match=pdpUrl.pathname.match(/\/co\/p\/([^/?#]+)/i);
  if(!match)throw new Error("Discovered CO PDP did not expose a SKU-shaped /co/p/<sku> route. Set CO_QST_PDP_URL and CO_QST_SKU explicitly.");
  return{pdpUrl,sku:decodeURIComponent(match[1])};
}
export async function addConfiguredProductToCoCart(page, config) {
  const resolved=await resolveProduct(page,config);
  await bootstrapCoStorefront(page,config);
  const product=new ProductPage(page,{setupUrl:config.setupUrl?.href||null,sku:resolved.sku,pdpUrl:resolved.pdpUrl.href,cartUrl:config.cartUrl.href});
  await product.addConfiguredPdpToCart({waitForCartMutation:true});
  return new CartPage(page,{cartUrl:config.cartUrl.href,sku:resolved.sku,productNamePattern:null,currencyPattern:/\$\s*[\d.,]+/});
}
