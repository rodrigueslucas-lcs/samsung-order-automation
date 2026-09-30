import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
export async function bootstrapCoStorefront(page, config) {
  if (!config.setupUrl) return;
  await page.goto(config.setupUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByText(/you can access pages now/i).waitFor({state:"visible",timeout:30000});
}
export async function addConfiguredProductToCoCart(page, config) {
  if (!config.pdpUrl || !config.sku) throw new Error("CO product proof is required. Set CO_QST_PDP_URL and CO_QST_SKU to a verified S2 Colombia product.");
  await bootstrapCoStorefront(page,config);
  const product=new ProductPage(page,{setupUrl:config.setupUrl?.href||null,sku:config.sku,pdpUrl:config.pdpUrl.href,cartUrl:config.cartUrl.href});
  await product.addConfiguredPdpToCart({waitForCartMutation:true});
  return new CartPage(page,{cartUrl:config.cartUrl.href,sku:config.sku,productNamePattern:null,currencyPattern:/\$\s*[\d.,]+/});
}
