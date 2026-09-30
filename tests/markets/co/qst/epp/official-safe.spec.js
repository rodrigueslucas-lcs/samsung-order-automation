import { test, expect } from "@playwright/test";
import ProductPage from "../../../../../pages/ProductPage";
import CartPage from "../../../../../pages/CartPage";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import coEvidenceMetadata from "../../../../../utils/qstCoEvidenceMetadata";
const {recordBusinessEvidence}=evidenceContext; const {getCoQstEvidenceMetadata}=coEvidenceMetadata;
function evidence(i,id){recordBusinessEvidence(i,getCoQstEvidenceMetadata(id));}
function cfg(){const base=process.env.CO_EPP_STOREFRONT_URL;test.skip(!base,"CO_EPP_STOREFRONT_URL is required.");const baseUrl=new URL(base);if(!baseUrl.pathname.toLowerCase().startsWith("/co/"))throw new Error("CO EPP URL must stay on /co/.");const pdp=process.env.CO_EPP_QST_PDP_URL;return{baseUrl,pdpUrl:pdp?new URL(pdp):null,sku:String(process.env.CO_EPP_QST_SKU||"").trim(),cartUrl:new URL("/co/cart",baseUrl.origin)};}
async function add(page,c){test.skip(!c.pdpUrl||!c.sku,"CO_EPP_QST_PDP_URL and CO_EPP_QST_SKU are required.");const p=new ProductPage(page,{setupUrl:null,sku:c.sku,pdpUrl:c.pdpUrl.href,cartUrl:c.cartUrl.href});await p.addConfiguredPdpToCart({waitForCartMutation:true});return new CartPage(page,{cartUrl:c.cartUrl.href,sku:c.sku,currencyPattern:/\$\s*[\d.,]+/});}
test.describe("CO QST - official EPP",()=>{test.describe.configure({timeout:420000});
test("SAM-24929 @qst @co @epp @safe - Facets Filter on PLP",async({page},i)=>{evidence(i,"SAM-24929");const c=cfg();await page.goto(c.baseUrl.href);await expect(page.getByText(/Filtrar|Filtro|Filter/i).filter({visible:true}).first()).toBeVisible({timeout:60000});});
test("SAM-24930 @qst @co @epp @safe - Able to add to Cart from PDP",async({page},i)=>{evidence(i,"SAM-24930");const c=await add(page,cfg());await c.validateProductInCart();});
test("SAM-24931 @qst @co @epp @safe - Cart page UI",async({page},i)=>{evidence(i,"SAM-24931");const c=await add(page,cfg());await c.validateProductInCart();await c.validateOrderSummary();await c.validateCartFooter();});
test("SAM-24942 @qst @co @epp - Step 1 Contact Details Section",async({page},i)=>{evidence(i,"SAM-24942");const c=await add(page,cfg());await c.proceedToCheckout();await expect(page.getByText(/Contacto|Contact|Nombre|Correo/i).filter({visible:true}).first()).toBeVisible({timeout:60000});});
test("SAM-24952 @qst @co @epp @safe - Verify Back to Top",async({page},i)=>{evidence(i,"SAM-24952");await add(page,cfg());await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await expect(page.getByText(/Volver al inicio|Back to top|Volver arriba|Subir/i).filter({visible:true}).first()).toBeVisible({timeout:30000});});
test("SAM-24953 @qst @co @epp @destructive - Payment using credit card with reg user",async({},i)=>{evidence(i,"SAM-24953");test.skip(true,"Canonical EPP payment case is represented; order placement requires authenticated CO EPP runtime plus authorized payment execution.");});
});