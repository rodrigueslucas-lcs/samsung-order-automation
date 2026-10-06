import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
export async function bootstrapCoStorefront(page, config) {
  if (!config.setupUrl) return;
  if (new URL(page.url()).pathname.startsWith("/co/") &&
      await page.getByRole("button",{name:"My Profile",exact:true}).isVisible().catch(()=>false)) return;
  await page.goto(config.setupUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  const setupReady=await page.getByText(/you can access pages now/i)
    .waitFor({state:"visible",timeout:8000}).then(()=>true,()=>false);
  if (setupReady) return;
  // getcookie sometimes returns an empty document despite setting the staging cookie.
  // Prove access against the storefront itself instead of requiring its prose.
  await page.goto(config.baseUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByRole("button",{name:"My Profile",exact:true})
    .waitFor({state:"visible",timeout:60000});
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
  return new CartPage(page,{
    cartUrl:config.cartUrl.href,
    sku:resolved.sku,
    productNamePattern:null,
    currencyPattern:/\$\s*[\d.,]+/,
    cartPageTitlePattern:/Tienes\s+1\s+Producto\(s\)\s+en\s+tu\s+carrito/i,
    orderSummaryPattern:/^Resumen$/i,
    summaryProductPattern:/1\s+Producto/i,
    checkoutButtonPattern:/^Continuar con la compra$/i,
    guestEmailPattern:/Escribe tu correo electr[oó]nico para tramitar el pedido/i,
    footerAccountPattern:/^Account$/i,
  });
}
