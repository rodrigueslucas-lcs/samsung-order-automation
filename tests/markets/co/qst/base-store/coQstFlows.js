import { test } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import { attachNetworkEvidence } from "../../../../../utils/networkEvidence";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";

const { recordBusinessEvidence } = evidenceContext;

export async function bootstrapCoStorefront(page, config) {
  return test.step("Bootstrap the CO storefront and validate staging access", async () => {
    if (!config.setupUrl) return;
    if (new URL(page.url()).pathname.startsWith("/co/") &&
        await page.getByRole("button",{name:"My Profile",exact:true}).isVisible().catch(()=>false)) return;
    await page.goto(config.setupUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
    const setupReady=await page.getByText(/you can access pages now/i)
      .waitFor({state:"visible",timeout:8000}).then(()=>true,()=>false);
    if (setupReady) return;
    await page.goto(config.baseUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
    await page.getByRole("button",{name:"My Profile",exact:true})
      .waitFor({state:"visible",timeout:60000});
  });
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

function applyCoS1KnownBlocker(config){
  if(config.environment!=="S1")return;
  const samId=test.info().title.match(/SAM-\d+/)?.[0];
  if(samId==="SAM-24893"){
    test.skip(true,"CO S1 Trade-up is BLOCKED by known defect SAM-25148: Trade-up / Plan Canje / Renueva is currently unavailable for the verified S1 product set.");
  }
  if(samId==="SAM-24915"){
    test.skip(true,"CO S1 Rewards payment is BLOCKED: Samsung Rewards redemption is currently unavailable in this environment.");
  }
}

export async function addConfiguredProductToCoCart(page, config) {
  applyCoS1KnownBlocker(config);
  return test.step("Open the controlled CO PDP, add the configured product and reach Cart", async () => {
    const resolved=await resolveProduct(page,config);
    const testInfo=test.info();
    recordBusinessEvidence(testInfo,{
      market:"CO",
      environment:config.environment,
      sku:resolved.sku,
      pdpUrl:resolved.pdpUrl.href,
    });
    await testInfo.attach("CO Product Context",{
      body:Buffer.from(JSON.stringify({market:"CO",environment:config.environment,sku:resolved.sku,pdpUrl:`${resolved.pdpUrl.origin}${resolved.pdpUrl.pathname}`},null,2)),
      contentType:"application/json",
    });
    await bootstrapCoStorefront(page,config);
    const product=new ProductPage(page,{setupUrl:config.setupUrl?.href||null,sku:resolved.sku,pdpUrl:resolved.pdpUrl.href,cartUrl:config.cartUrl.href});
    const addResponse=page.waitForResponse((response)=>{
      const request=response.request();
      const url=new URL(response.url());
      return request.method()==="POST" && /\/co\/users\/[^/]+\/carts\/[^/]+\/entries(?:\/|$)/i.test(url.pathname);
    },{timeout:60000}).catch(()=>null);
    await product.addConfiguredPdpToCart({waitForCartMutation:true});
    const response=await addResponse;
    if(response) await attachNetworkEvidence(testInfo,"Add to Cart",{response});
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
      footerAccountPattern:config.environment==="S1"?/^Sobre nosotros$/i:/^Account$/i,
    });
  });
}
