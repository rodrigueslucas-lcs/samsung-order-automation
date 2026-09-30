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
for(const [id,title] of [
["SAM-24880","Add product from BC Page"],["SAM-24882","Cart page UI"],["SAM-24883","Increase decrease delete quantity"],["SAM-24886","Verify rewards text as Guest User"],["SAM-24892","Add SC+ from BC PDP Page"],["SAM-24893","Verify trade-up cart page"],["SAM-24896","Cart value when Reg user logs out"],["SAM-24898","Checkout button on cart page"],["SAM-24899","Order Summary on checkout page"],["SAM-24900","Step 1 Contact Details Section"],["SAM-24901","Add Edit saved new address"],["SAM-24902","Select saved address"],["SAM-24903","Save option for reg user"],["SAM-24904","Able to checkout with New address"],["SAM-24905","Save option not visible"],["SAM-24909","Validate Invalid address details"],["SAM-24910","Validate switching delivery modes address"],["SAM-24911","Verify Back to Top"],["SAM-24912","Payment using credit card with reg user"],["SAM-24915","Payment using Rewards"],["SAM-24919","Track Order"],["SAM-24920","Backoffice"],["SAM-24925","Mobile Sticky checkout"]]){
 test(`${id} @qst @co @base-store - ${title}`,async({page},i)=>{evidence(i,id);const cfg=getCoQstConfig();const c=await cart(page,cfg);
  if(id==="SAM-24882"){await c.validateCartPage();await c.validateOrderSummary();await c.validateCartFooter();return;}
  if(id==="SAM-24883"){await c.validateQuantityCanChange();return;}
  if(id==="SAM-24886"){await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
  if(id==="SAM-24892"){await expect(page.getByText(/Samsung Care\+|SC\+/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
  if(id==="SAM-24893"){await expect(page.getByText(/Trade[- ]?up|Plan Canje|Renueva/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
  if(id==="SAM-24898"){await c.proceedToCheckout();return;}
  if(id==="SAM-24899"){await c.proceedToCheckout();await expect(page.getByText(/Resumen|Order Summary/i).filter({visible:true}).first()).toBeVisible({timeout:60000});return;}
  if(id==="SAM-24911"){await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await expect(page.getByText(/Volver al inicio|Back to top|Volver arriba|Subir/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
  if(id==="SAM-24925"){await page.setViewportSize({width:390,height:844});await expect(page.getByRole("button",{name:/checkout|comprar|continuar/i}).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
  test.skip(true,`${id} has canonical CO coverage but needs live CO checkout/auth/payment data before a non-speculative assertion can be promoted.`);
 });
}
test("SAM-24914 @not-run @qst @co @base-store @payment - Payment using ADDI pay",async({},i)=>{evidence(i,"SAM-24914");test.skip(true,"Official source is BLOCKED and documents a PSE/BO/Kibana callback workflow; no automated bypass or fabricated payment completion.");});
});
