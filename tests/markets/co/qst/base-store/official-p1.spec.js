import { test, expect } from "@playwright/test";
import HomePage from "../../../../../pages/HomePage";
import coConfigModule from "../../../../../config/markets/co";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import coEvidenceMetadata from "../../../../../utils/qstCoEvidenceMetadata";
import { addConfiguredProductToCoCart, bootstrapCoStorefront } from "./coQstFlows";
const {getCoQstConfig}=coConfigModule;
const {recordBusinessEvidence}=evidenceContext;
const {getCoQstEvidenceMetadata}=coEvidenceMetadata;
const productCases=new Set(["SAM-24880","SAM-24882","SAM-24883","SAM-24886","SAM-24892","SAM-24893","SAM-24896","SAM-24898","SAM-24899","SAM-24900","SAM-24901","SAM-24902","SAM-24903","SAM-24904","SAM-24905","SAM-24909","SAM-24910","SAM-24911","SAM-24912","SAM-24915","SAM-24919","SAM-24920","SAM-24925"]);
function evidence(info,id){recordBusinessEvidence(info,getCoQstEvidenceMetadata(id));}
async function home(page,cfg){await bootstrapCoStorefront(page,cfg);await page.goto(cfg.baseUrl.href,{waitUntil:"domcontentloaded"});await expect(page.getByRole("button",{name:"My Profile",exact:true})).toBeVisible({timeout:60000});}
async function cart(page,cfg){const c=await addConfiguredProductToCoCart(page,cfg);await c.validateProductInCart();return c;}
test.describe("CO QST - Base Store official P1",()=>{test.describe.configure({timeout:420000});
test("SAM-24806 @qst @co @base-store @safe - UI validation in desktop view",async({page},i)=>{evidence(i,"SAM-24806");const c=getCoQstConfig();await home(page,c);const h=new HomePage(page,{setupUrl:null,homeUrl:c.baseUrl.href,footerHeadingPattern:/Tienda|Shop|Samsung/i});const a=await h.validateHomepageAttributes();expect(a.headerVisible).toBe(true);expect(a.footerVisible).toBe(true);expect(await page.locator("img").count()).toBeGreaterThan(0);});
test("SAM-24873 @qst @co @base-store @registered - Login Home page",async({page},i)=>{evidence(i,"SAM-24873");const c=getCoQstConfig();await home(page,c);await page.getByRole("button",{name:"My Profile",exact:true}).hover();await expect(page.getByText(/Cerrar Sesi[oó]n/i).filter({visible:true}).first()).toBeVisible({timeout:30000});});
test("SAM-24874 @qst @co @base-store @registered - Validate My account menu",async({page},i)=>{evidence(i,"SAM-24874");const c=getCoQstConfig();await home(page,c);await page.getByRole("button",{name:"My Profile",exact:true}).hover();for(const x of [/My page|Mi p[aá]gina/i,/My Orders|Mis pedidos/i,/Wishlist|Lista de deseos/i,/Cerrar Sesi[oó]n/i]) await expect(page.getByText(x).filter({visible:true}).first()).toBeVisible({timeout:30000});});
test("SAM-24875 @qst @co @base-store @safe - GNB menu",async({page},i)=>{evidence(i,"SAM-24875");const c=getCoQstConfig();await home(page,c);await expect(page.locator("header").first()).toBeVisible();await expect(page.locator("header a").first()).toBeVisible();});
test("SAM-24879 @qst @co @base-store @safe - Facets Filter on PLP",async({page},i)=>{evidence(i,"SAM-24879");const c=getCoQstConfig();await home(page,c);const nav=page.getByRole("link",{name:/Galaxy|Smartphone|TV|Televisores/i}).filter({visible:true}).first();await nav.click();await expect(page.getByText(/Filtrar|Filtro|Filter/i).filter({visible:true}).first()).toBeVisible({timeout:60000});});
async function runCanonicalCase(id,page,info){evidence(info,id);const cfg=getCoQstConfig();const c=await cart(page,cfg);
if(id==="SAM-24882"){await c.validateCartPage();await c.validateOrderSummary();await c.validateCartFooter();return;}
if(id==="SAM-24883"){await c.validateQuantityCanChange();return;}
if(id==="SAM-24886"){await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24892"){await expect(page.getByText(/Samsung Care\\+|SC\\+/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24893"){await expect(page.getByText(/Trade[- ]?up|Plan Canje|Renueva/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24898"){await c.proceedToCheckout();return;}
if(id==="SAM-24899"){await c.proceedToCheckout();await expect(page.getByText(/Resumen|Order Summary/i).filter({visible:true}).first()).toBeVisible({timeout:60000});return;}
if(id==="SAM-24911"){await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await expect(page.getByText(/Volver al inicio|Back to top|Volver arriba|Subir/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24925"){await page.setViewportSize({width:390,height:844});await expect(page.getByRole("button",{name:/checkout|comprar|continuar/i}).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
test.skip(true,id+" is represented canonically but requires live CO checkout/auth/payment data before promotion.");
}
test("SAM-24880 @qst @co @base-store - Add product from BC Page",async({page},i)=>runCanonicalCase("SAM-24880",page,i));
test("SAM-24882 @qst @co @base-store - Cart page UI",async({page},i)=>runCanonicalCase("SAM-24882",page,i));
test("SAM-24883 @qst @co @base-store - Increase decrease delete quantity",async({page},i)=>runCanonicalCase("SAM-24883",page,i));
test("SAM-24886 @qst @co @base-store - Verify rewards text as Guest User",async({page},i)=>runCanonicalCase("SAM-24886",page,i));
test("SAM-24892 @qst @co @base-store - Add SC+ from BC PDP Page",async({page},i)=>runCanonicalCase("SAM-24892",page,i));
test("SAM-24893 @qst @co @base-store - Verify trade-up cart page",async({page},i)=>runCanonicalCase("SAM-24893",page,i));
test("SAM-24896 @qst @co @base-store - Cart value when Reg user logs out",async({page},i)=>runCanonicalCase("SAM-24896",page,i));
test("SAM-24898 @qst @co @base-store - Checkout button on cart page",async({page},i)=>runCanonicalCase("SAM-24898",page,i));
test("SAM-24899 @qst @co @base-store - Order Summary on checkout page",async({page},i)=>runCanonicalCase("SAM-24899",page,i));
test("SAM-24900 @qst @co @base-store - Step 1 Contact Details Section",async({page},i)=>runCanonicalCase("SAM-24900",page,i));
test("SAM-24901 @qst @co @base-store - Add Edit saved new address",async({page},i)=>runCanonicalCase("SAM-24901",page,i));
test("SAM-24902 @qst @co @base-store - Select saved address",async({page},i)=>runCanonicalCase("SAM-24902",page,i));
test("SAM-24903 @qst @co @base-store - Save option for reg user",async({page},i)=>runCanonicalCase("SAM-24903",page,i));
test("SAM-24904 @qst @co @base-store - Able to checkout with New address",async({page},i)=>runCanonicalCase("SAM-24904",page,i));
test("SAM-24905 @qst @co @base-store - Save option not visible",async({page},i)=>runCanonicalCase("SAM-24905",page,i));
test("SAM-24909 @qst @co @base-store - Validate Invalid address details",async({page},i)=>runCanonicalCase("SAM-24909",page,i));
test("SAM-24910 @qst @co @base-store - Validate switching delivery modes address",async({page},i)=>runCanonicalCase("SAM-24910",page,i));
test("SAM-24911 @qst @co @base-store - Verify Back to Top",async({page},i)=>runCanonicalCase("SAM-24911",page,i));
test("SAM-24912 @qst @co @base-store - Payment using credit card with reg user",async({page},i)=>runCanonicalCase("SAM-24912",page,i));
test("SAM-24915 @qst @co @base-store - Payment using Rewards",async({page},i)=>runCanonicalCase("SAM-24915",page,i));
test("SAM-24919 @qst @co @base-store - Track Order",async({page},i)=>runCanonicalCase("SAM-24919",page,i));
test("SAM-24920 @qst @co @base-store - Backoffice",async({page},i)=>runCanonicalCase("SAM-24920",page,i));
test("SAM-24925 @qst @co @base-store - Mobile Sticky checkout",async({page},i)=>runCanonicalCase("SAM-24925",page,i));
test("SAM-24914 @not-run @qst @co @base-store @payment - Payment using ADDI pay",async({},i)=>{evidence(i,"SAM-24914");test.skip(true,"Official source is BLOCKED and documents a PSE/BO/Kibana callback workflow; no automated bypass or fabricated payment completion.");});
});
