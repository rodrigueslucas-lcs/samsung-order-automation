import { test, expect } from "@playwright/test";
import HomePage from "../../../../../pages/HomePage";
import coConfigModule from "../../../../../config/markets/co";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import coEvidenceMetadata from "../../../../../utils/qstCoEvidenceMetadata";
import coAuthStateModule from "../../../../../utils/coAuthState";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";
import { addConfiguredProductToCoCart, bootstrapCoStorefront } from "./coQstFlows";
import cartPresentation from "../../../../../flows/smb/cartPresentation";
const {getCoQstConfig}=coConfigModule;
const {recordBusinessEvidence}=evidenceContext;
const {getCoQstEvidenceMetadata}=coEvidenceMetadata;
const {CO_AUTH_STATE_PATH,getCoAuthState,hasCoAuthState}=coAuthStateModule;
const {getBackOfficeAdminCredentials}=backofficeCredentials;
const {validateCartItemPresentation,inspectAvailableServices}=cartPresentation;
const productCases=new Set(["SAM-24880","SAM-24882","SAM-24883","SAM-24886","SAM-24892","SAM-24893","SAM-24896","SAM-24898","SAM-24899","SAM-24900","SAM-24901","SAM-24902","SAM-24903","SAM-24904","SAM-24905","SAM-24909","SAM-24910","SAM-24911","SAM-24912","SAM-24915","SAM-24919","SAM-24920","SAM-24925"]);
function evidence(info,id){recordBusinessEvidence(info,getCoQstEvidenceMetadata(id));}
async function home(page,cfg){await bootstrapCoStorefront(page,cfg);await page.goto(cfg.baseUrl.href,{waitUntil:"domcontentloaded"});await expect(page.getByRole("button",{name:"My Profile",exact:true})).toBeVisible({timeout:60000});}
async function authenticatedPage(browser,cfg){test.skip(!hasCoAuthState(),"CO authenticated state is required.");const context=await browser.newContext({storageState:CO_AUTH_STATE_PATH});await getCoAuthState().applyAuthSessionStorage(context);const page=await context.newPage();await home(page,cfg);return {context,page};}
async function cart(page,cfg){const c=await addConfiguredProductToCoCart(page,cfg);await c.validateProductInCart();return c;}
async function coGuestCheckout(page,cartPage){
  try {
    await cartPage.proceedToCheckout();
  } catch (error) {
    if (!/\/co\/cart(?:\?|$)/i.test(page.url())) throw error;
    await page.reload({waitUntil:"domcontentloaded"});
    await cartPage.proceedToCheckout();
  }
  const email=page.getByPlaceholder(/Escribe tu correo electr[oó]nico para tramitar el pedido/i);
  await expect(email).toBeVisible({timeout:30000});
  await email.fill(`co-qst-${Date.now()}@mailinator.com`);
  await page.getByRole("button",{name:"Continuar como invitado",exact:true}).click();
  try {
    await expect(page).toHaveURL(/\/co\/checkout\/one(?:\?|$)/i,{timeout:30000});
  } catch (error) {
    if (!/\/co\/guestlogin\/checkout(?:\?|$)/i.test(page.url())) throw error;
    await page.reload({waitUntil:"domcontentloaded"});
    await email.fill(`co-qst-${Date.now()}@mailinator.com`);
    await page.getByRole("button",{name:"Continuar como invitado",exact:true}).click();
    await expect(page).toHaveURL(/\/co\/checkout\/one(?:\?|$)/i,{timeout:30000});
  }
}
async function fillCoGuestContact(page){
  const firstName=page.getByRole("textbox",{name:"firstName",exact:true});
  await expect(firstName).toBeVisible({timeout:60000});
  const reminder=page.getByRole("dialog").filter({hasText:/¡Listo!/i});
  const dismissReminder=async()=>{
    if(await reminder.isVisible().catch(()=>false))await reminder.getByText(/¡Listo!/i).click();
  };
  await dismissReminder();
  await firstName.fill("Cliente");
  await page.getByRole("textbox",{name:"lastName",exact:true}).fill("Prueba");
  await page.getByRole("textbox",{name:"phone",exact:true}).fill("3001234567");
  await dismissReminder();
  const documentType=page.locator('mat-select[name="identificationType"]');
  await documentType.click({timeout:5000}).catch(async(error)=>{
    if(!(await reminder.isVisible().catch(()=>false)))throw error;
    await dismissReminder();
    await documentType.click();
  });
  await page.getByRole("option").filter({hasText:/Pasaporte/i}).first().click();
  await page.getByRole("textbox",{name:"vatNumber",exact:true}).fill("AB1234567");
  await page.getByRole("checkbox",{name:"Persona Natural",exact:true}).check();
  await page.locator('input[name="purchaseCompany"]').check();
  await page.getByRole("textbox",{name:"companyEmail",exact:true}).fill("co-qst-company@mailinator.com");
  await page.getByRole("textbox",{name:"companyName",exact:true}).fill("QA Automation");
  await page.getByRole("textbox",{name:"companyId",exact:true}).fill("9001234567");
  await page.getByRole("textbox",{name:"companyPhone",exact:true}).fill("3001234567");
  const next=page.getByRole("button",{name:/Continuar con el m[eé]todo de env[ií]o/i});
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:60000});
}
test.describe("CO QST - Base Store official P1",()=>{test.describe.configure({timeout:420000});
test("SAM-24806 @qst @co @base-store @safe - UI validation in desktop view",async({page},i)=>{evidence(i,"SAM-24806");const c=getCoQstConfig();await home(page,c);const h=new HomePage(page,{setupUrl:null,homeUrl:c.baseUrl.href,footerHeadingPattern:/Tienda|Shop|Samsung/i});const a=await h.validateHomepageAttributes();expect(a.headerVisible).toBe(true);expect(a.footerVisible).toBe(true);expect(await page.locator("img").count()).toBeGreaterThan(0);});
test("SAM-24873 @qst @co @base-store @registered - Login Home page",async({browser},i)=>{evidence(i,"SAM-24873");const c=getCoQstConfig();const {context,page}=await authenticatedPage(browser,c);await page.getByRole("button",{name:"My Profile",exact:true}).hover();await expect(page.getByText(/Cerrar Sesi[oó]n/i).filter({visible:true}).first()).toBeVisible({timeout:30000});await context.close();});
test("SAM-24874 @qst @co @base-store @registered - Validate My account menu",async({browser},i)=>{evidence(i,"SAM-24874");const c=getCoQstConfig();const {context,page}=await authenticatedPage(browser,c);await page.getByRole("button",{name:"My Profile",exact:true}).hover();for(const x of [/My page|Mi p[aá]gina/i,/My Orders|Mis pedidos/i,/Wishlist|Lista de deseos/i,/Cerrar Sesi[oó]n/i]) await expect(page.getByText(x).filter({visible:true}).first()).toBeVisible({timeout:30000});await context.close();});
test("SAM-24875 @qst @co @base-store @safe - GNB menu",async({page},i)=>{evidence(i,"SAM-24875");const c=getCoQstConfig();await home(page,c);await expect(page.locator("header").first()).toBeVisible();await expect(page.locator("header a").first()).toBeVisible();});
test("SAM-24879 @qst @co @base-store @safe - Facets Filter on PLP",async({page},i)=>{evidence(i,"SAM-24879");const c=getCoQstConfig();await home(page,c);const nav=page.getByRole("link",{name:/Galaxy|Smartphone|TV|Televisores/i}).filter({visible:true}).first();await nav.click();await expect(page.getByText(/Filtrar|Filtro|Filter/i).filter({visible:true}).first()).toBeVisible({timeout:60000});});
async function runCanonicalCase(id,page,info){evidence(info,id);const cfg=getCoQstConfig();
if(id==="SAM-24920"){process.env.BACKOFFICE_ENV=cfg.environment.toLowerCase();const credentials=getBackOfficeAdminCredentials();test.skip(!credentials.password,"Shared environment-scoped BackOffice credentials are required.");const orders=new BackOfficeOrderPage(page);await orders.login({...credentials,authority:"admin"});await orders.openAdminOrders();const order=await orders.openFirstAdminOrderAndReadStatus();expect(order.orderCode).toBeTruthy();expect(order.status).toBeTruthy();return;}
if(id==="SAM-24912"){
  test.skip(!hasCoAuthState(),"CO authenticated state is required for SAM-24912.");
  const auth=getCoAuthState();
  await auth.installPersistedBrowserState(page.context(),page);
  await auth.validateAuthenticatedSession(page);
  await page.keyboard.press("Escape");

  const registeredCart=await cart(page,cfg);
  await registeredCart.proceedToAuthenticatedCheckout();
  await page.waitForURL(/CHECKOUT_STEP_(CONTACT_INFO|DELIVERY)/,{waitUntil:"domcontentloaded",timeout:60000});

  if(/CHECKOUT_STEP_CONTACT_INFO/.test(page.url())){
    await fillCoGuestContact(page);
  }

  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:60000});
  const checkout=new CheckoutPage(page);

  await checkout.selectShippingMethod();

  const continueToPayment=page.getByRole("button",{
    name:/Continuar con (?:el pago|los m[eé]todos de pago)/i
  }).filter({visible:true}).first();
  await expect(continueToPayment).toBeVisible({timeout:30000});
  await expect(continueToPayment).toBeEnabled({timeout:30000});
  await continueToPayment.click();

  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i,{timeout:60000});
  console.log("[SAM-24912] Payment reached. Pausing for manual payment-method inspection.");
  await page.pause();
  return;
}
if(id==="SAM-24892"){
  test.skip(true,"Official CO Care+ case is BLOCKED: the configured fridge and verified SM-S928BZTKLTC mobile expose no Samsung Care+ option. An eligible SKU is required before testing add-to-cart persistence.");
}
const c=await cart(page,cfg);
if(id==="SAM-24882"){await c.validateCartPage();await validateCartItemPresentation(page,{sku:cfg.sku,currencyPattern:/\$\s*[\d.,]+/});await c.validateOrderSummary();await inspectAvailableServices(page);await c.validateCartFooter();return;}
if(id==="SAM-24883"){await c.validateQuantityCanChange();return;}
if(id==="SAM-24886"){await expect(page.getByText(/Samsung Rewards|Rewards|puntos/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24893"){await expect(page.getByText(/Trade[- ]?up|Plan Canje|Renueva/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24898"){await coGuestCheckout(page,c);return;}
if(id==="SAM-24899"){await coGuestCheckout(page,c);await expect(page.getByText(/Resumen|Order Summary|Ver pedido/i).filter({visible:true}).first()).toBeVisible({timeout:60000});await expect(page.getByText(/Total/i).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
if(id==="SAM-24900"){await coGuestCheckout(page,c);await fillCoGuestContact(page);return;}
if(id==="SAM-24905"){
  await coGuestCheckout(page,c);
  await fillCoGuestContact(page);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:30000});
  const delivery=page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
  await expect(delivery).toBeVisible({timeout:60000});
  await expect(delivery.getByText("Dirección de entrega",{exact:true})).toBeVisible({timeout:60000});
  await expect(delivery.locator('mat-select[name="regionIso"]')).toBeVisible();
  await expect(delivery.locator('input[name="saveInAddressBook"]:not([disabled])')).toHaveCount(0);
  await expect(delivery.locator('input[name="saveInAddressBook"]:disabled')).toHaveCount(2);
  return;
}
if(id==="SAM-24909"){
  await coGuestCheckout(page,c);
  await fillCoGuestContact(page);
  await page.reload({waitUntil:"domcontentloaded"});
  const delivery=page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
  await expect(delivery.getByText("Dirección de entrega",{exact:true})).toBeVisible({timeout:60000});
  const street=delivery.locator('input[name="line2_b"]');
  await street.fill("   ");
  const continueToPayment=delivery.getByRole("button",{name:/Continuar con el pago/i});
  await continueToPayment.click({timeout:5000}).catch(async(error)=>{
    const reminder=page.getByRole("dialog").filter({hasText:/¡Listo!/i});
    if(!(await reminder.isVisible().catch(()=>false)))throw error;
    await reminder.getByText(/^¡Listo!$/i).click();
    await continueToPayment.click();
  });
  await expect(street.locator("xpath=ancestor::mat-form-field[1]").locator("mat-error:visible").first()).toHaveText(/Por favor ingresa una direcci[oó]n v[aá]lida/i,{timeout:30000});
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i);
  return;
}
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
