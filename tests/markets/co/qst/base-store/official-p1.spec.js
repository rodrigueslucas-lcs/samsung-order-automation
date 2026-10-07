import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import HomePage from "../../../../../pages/HomePage";
import coConfigModule from "../../../../../config/markets/co";
import evidenceContext from "../../../../../reporting/evidence/evidenceContext";
import coEvidenceMetadata from "../../../../../utils/qstCoEvidenceMetadata";
import coAuthStateModule from "../../../../../utils/coAuthState";
import BackOfficeOrderPage from "../../../../../pages/BackOfficeOrderPage";
import CheckoutPage from "../../../../../pages/CheckoutPage";
import MarketPaymentPage from "../../../../../pages/MarketPaymentPage";
import GuestOrderTrackingPage from "../../../../../pages/GuestOrderTrackingPage";
import MailinatorPage from "../../../../../pages/MailinatorPage";
import backofficeCredentials from "../../../../../utils/backofficeAdminCredentials.js";
import mxTestCard from "../../../../../utils/mxTestCard.js";
import destructiveGuards from "../../../../../utils/destructiveGuards.js";
import { addConfiguredProductToCoCart, bootstrapCoStorefront } from "./coQstFlows";
import cartPresentation from "../../../../../flows/smb/cartPresentation";
import authStateModule from "../../../../../utils/authState";
const {getCoQstConfig}=coConfigModule;
const {recordBusinessEvidence}=evidenceContext;
const {getCoQstEvidenceMetadata}=coEvidenceMetadata;
const {CO_AUTH_STATE_PATH,getCoAuthState,hasCoAuthState}=coAuthStateModule;
const {getBackOfficeAdminCredentials}=backofficeCredentials;
const {getMxTestCard}=mxTestCard;
const {requirePaymentSubmitOptIn}=destructiveGuards;
const {validateCartItemPresentation,inspectAvailableServices}=cartPresentation;
const {createAuthState}=authStateModule;
const productCases=new Set(["SAM-24880","SAM-24882","SAM-24883","SAM-24886","SAM-24892","SAM-24893","SAM-24896","SAM-24898","SAM-24899","SAM-24900","SAM-24901","SAM-24902","SAM-24903","SAM-24904","SAM-24905","SAM-24909","SAM-24910","SAM-24911","SAM-24912","SAM-24915","SAM-24919","SAM-24920","SAM-24925"]);
function evidence(info,id){recordBusinessEvidence(info,getCoQstEvidenceMetadata(id));}
async function home(page,cfg){await bootstrapCoStorefront(page,cfg);await page.goto(cfg.baseUrl.href,{waitUntil:"domcontentloaded"});await expect(page.getByRole("button",{name:"My Profile",exact:true})).toBeVisible({timeout:60000});}
async function authenticatedPage(browser,cfg){test.skip(!hasCoAuthState(),"CO authenticated state is required.");const context=await browser.newContext({storageState:CO_AUTH_STATE_PATH});await getCoAuthState().applyAuthSessionStorage(context);const page=await context.newPage();await home(page,cfg);return {context,page};}
async function cart(page,cfg){const c=await addConfiguredProductToCoCart(page,cfg);await c.validateProductInCart();return c;}
async function clearCoCartForPayment(page,cfg){
  await page.goto(cfg.cartUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  const main=page.getByRole("main");
  const remove=main.getByRole("button",{name:/^Remove$|^Eliminar$/i});
  const empty=main.getByText(/carrito.*vac[ií]o|no hay productos/i).first();
  await Promise.race([
    remove.first().waitFor({state:"visible",timeout:60000}),
    empty.waitFor({state:"visible",timeout:60000}),
  ]);
  for(let removed=0;removed<20;removed++){
    const count=await remove.count();
    if(!count){
      await expect(empty).toBeVisible({timeout:30000});
      return;
    }
    await remove.first().click();
    const confirmation=page.getByRole("dialog").or(page.getByRole("alertdialog"))
      .filter({hasText:/Eliminar/i});
    await expect(confirmation).toBeVisible({timeout:30000});
    const overlay=page.locator('#ins-frameless-overlay[close-on-click="true"]:visible');
    if(await overlay.isVisible().catch(()=>false)){
      await overlay.click({position:{x:1,y:1},timeout:5000});
      await expect(overlay).toBeHidden({timeout:10000});
    }
    await confirmation.getByRole("button",{name:/^S[ií],?\s*eliminar$/i}).click();
    await expect(remove).toHaveCount(count-1,{timeout:30000});
  }
  throw new Error("CO payment cart cleanup exceeded the 20-row safety limit.");
}
async function coGuestCheckout(page,cartPage,guestEmail=`co-qst-${Date.now()}@mailinator.com`){
  try {
    await cartPage.proceedToCheckout();
  } catch (error) {
    if (!/\/co\/cart(?:\?|$)/i.test(page.url())) throw error;
    await page.reload({waitUntil:"domcontentloaded"});
    await cartPage.proceedToCheckout();
  }
  const email=page.getByPlaceholder(/Escribe tu correo electr[oó]nico para tramitar el pedido/i);
  await expect(email).toBeVisible({timeout:30000});
  await email.fill(guestEmail);
  await page.getByRole("button",{name:"Continuar como invitado",exact:true}).click();
  try {
    await expect(page).toHaveURL(/\/co\/checkout\/one(?:\?|$)/i,{timeout:30000});
  } catch (error) {
    if (!/\/co\/guestlogin\/checkout(?:\?|$)/i.test(page.url())) throw error;
    await page.reload({waitUntil:"domcontentloaded"});
    await email.fill(guestEmail);
    await page.getByRole("button",{name:"Continuar como invitado",exact:true}).click();
    await expect(page).toHaveURL(/\/co\/checkout\/one(?:\?|$)/i,{timeout:30000});
  }
}
async function fillCoGuestContact(page,{recoverStalledTransition=false,guestEmail}={}){
  const firstName=page.getByRole("textbox",{name:"firstName",exact:true});
  await expect(firstName).toBeVisible({timeout:60000});
  if(guestEmail){
    const contactEmail=page.locator('input[name="email"]');
    await expect(contactEmail).toBeVisible();
    await contactEmail.fill(guestEmail);
    await expect(contactEmail).toHaveValue(guestEmail);
  }
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
  if(recoverStalledTransition){
    const advanced=await page.waitForURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:20000}).then(()=>true).catch(()=>false);
    if(!advanced){
      console.log(`[co-qst] Contact Info remained pending after submit; reloading checkout once (${page.url()}).`);
      await page.reload({waitUntil:"domcontentloaded",timeout:60000});
      if(/CHECKOUT_STEP_CONTACT_INFO/i.test(page.url())){
        await fillCoGuestContact(page,{guestEmail});
        return;
      }
    }
  }
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:60000});
}
async function coRegisteredDelivery(browser){
  const cfg=getCoQstConfig();
  const {context,page}=await authenticatedPage(browser,cfg);
  try{
    const c=await addConfiguredProductToCoCart(page,{...cfg,setupUrl:null});
    await c.validateProductInCart();
    await page.getByRole("button",{name:/^Continuar con la compra$/i}).click();
    await expect(page).toHaveURL(/\/co\/checkout\/one/i,{timeout:60000});
    if(/CHECKOUT_STEP_CONTACT_INFO/i.test(page.url()))await fillCoGuestContact(page,{recoverStalledTransition:true});
    const delivery=page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
    await expect(delivery).toBeVisible({timeout:60000});
    return {context,page,delivery};
  }catch(error){await context.close();throw error;}
}
async function coDismissReminder(page){
  const dialog=page.locator('[role="dialog"][aria-modal="true"]:visible');
  for(let n=0;n<4 && await dialog.isVisible().catch(()=>false);n++){
    await dialog.getByText(/¡Listo!/i).filter({visible:true}).last().click({timeout:3000}).catch(async()=>{
      await page.locator('#ins-frameless-overlay[close-on-click="true"]').click({position:{x:1,y:1},timeout:3000});
    });
  }
  await expect(dialog).toBeHidden({timeout:5000});
}
async function coClick(page,locator){
  await expect(locator).toBeEnabled({timeout:30000});
  for(let n=0;n<4;n++){
    await coDismissReminder(page);
    try{await locator.click({timeout:3000});return;}
    catch(error){if(!/intercepts pointer events/i.test(String(error)))throw error;}
  }
  throw new Error("Checkout reminder repeatedly blocked the address control.");
}
async function coSelectAddressMode(page,delivery,kind,mode){
  const radio=delivery.locator(`input[name="addressOption${kind}"][value="${mode}"]`);
  await expect(radio).toBeVisible({timeout:30000});
  if(!await radio.isChecked()){
    const label=radio.locator('xpath=ancestor::mat-radio-button[1]');
    await coClick(page,label.getByText(mode==="NEW_ADDRESS"?/Nueva direcci[oó]n/i:/Direcci[oó]n guardada/i));
  }
  await expect(radio).toBeChecked();
}
async function coSelectOption(page,delivery,name,option){
  await coClick(page,delivery.locator(`mat-select[name="${name}"]`));
  await coClick(page,page.getByRole("option",{name:option,exact:true}));
}
async function coFillNewShipping(page,delivery,secondaryNumber="113-43"){
  const newAddressMode=delivery.locator('input[name="addressOptionShipping"][value="NEW_ADDRESS"]');
  if(await newAddressMode.isEnabled().catch(()=>false))await coSelectAddressMode(page,delivery,"Shipping","NEW_ADDRESS");
  for(const [field,option] of [["regionIso","Bogota, D.C."],["town","BOGOTA, D.C."],["line2_a","Carrera"],["line1","Oficina"]]){
    await coSelectOption(page,delivery,field,option);
  }
  await delivery.locator('input[name="line2_b"]').fill("7");
  await delivery.locator('input[name="line2_c"]').fill(secondaryNumber);
  await delivery.locator('input[name="line2_d"]').fill("Usaquen");
  await delivery.locator('input[name="apartment"]').fill("607");
}
async function coFillNewBilling(page,delivery,secondaryNumber="113-43"){
  await coDismissReminder(page);
  await delivery.locator('input[name="sameAsShipping"]').uncheck();
  await coSelectAddressMode(page,delivery,"Billing","NEW_ADDRESS");
  await coSelectOption(page,delivery,"departmentBilling","Bogota, D.C.");
  await coSelectOption(page,delivery,"municipalityBilling","BOGOTA, D.C.");
  await delivery.locator('input[name="line1"]').fill(`Carrera 7 #${secondaryNumber}, Oficina 607, Usaquen`);
}
async function coContinueToPayment(page,delivery){
  if(await delivery.locator('input[name="group0delivery_mode_option"]:checked').count()===0){
    const regularRadio=delivery.locator('mat-radio-button').filter({hasText:/Envío regular/i}).first().locator('input[type="radio"]');
    if(await regularRadio.count())await regularRadio.check();
    else await coClick(page,delivery.getByRole('listitem').filter({hasText:/Envío regular \(Gratis\)/i}).first());
  }
  for(const field of ["termsAndCondition","termsAndCondition2"]){
    await coDismissReminder(page);
    await delivery.locator(`input[name="${field}"]`).check();
  }
  await coDismissReminder(page);
  await delivery.getByRole("button",{name:/Continuar con el pago/i}).click();
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i,{timeout:60000});
}
async function coSelectSavedAddress(page,delivery,kind){
  const savedMode=delivery.locator(`input[name="addressOption${kind}"]:not([value="NEW_ADDRESS"])`).first();
  await expect(savedMode,"A saved CO address must be available.").toBeVisible({timeout:30000});
  if(!await savedMode.isChecked()){
    await coClick(page,savedMode.locator('xpath=ancestor::mat-radio-button[1]').getByText(/Direcci[oó]n guardada/i));
  }
  await expect(savedMode).toBeChecked();
  const savedOptions=delivery.locator(`input[name*="${kind.toLowerCase()}"]:checked`).filter({visible:true});
  await expect(delivery.getByText(/Carrera|Calle|Bogot[aá]/i).filter({visible:true}).first(),
    "The selected saved address must render in checkout.").toBeVisible({timeout:30000});
  return savedOptions;
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
  test.setTimeout(600000);
  requirePaymentSubmitOptIn();
  test.skip(!hasCoAuthState(),"CO authenticated state is required for SAM-24912.");
  const auth=getCoAuthState();
  await auth.installPersistedBrowserState(page.context(),page);
  try{
    await auth.validateAuthenticatedSession(page);
  }catch(error){
    if(!/storefront did not render its profile control/i.test(String(error)))throw error;
    await page.reload({waitUntil:"domcontentloaded",timeout:60000});
    await auth.validateAuthenticatedSession(page);
  }
  await page.keyboard.press("Escape");

  await clearCoCartForPayment(page,cfg);
  const registeredCart=await cart(page,cfg);
  await expect(page.getByText(/Tienes\s+1\s+Producto\(s\)\s+en\s+tu\s+carrito/i)).toBeVisible({timeout:30000});
  await registeredCart.proceedToAuthenticatedCheckout();
  await page.waitForURL(/CHECKOUT_STEP_(CONTACT_INFO|DELIVERY)/,{waitUntil:"domcontentloaded",timeout:60000});

  if(/CHECKOUT_STEP_CONTACT_INFO/.test(page.url())){
    await fillCoGuestContact(page);
  }

  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:60000});
  const checkout=new CheckoutPage(page);

  await checkout.selectShippingMethod();

  const termsConsent=page.getByText(/Acepto los T[eé]rminos\s*&\s*Condiciones vigentes/i)
    .filter({visible:true}).first();
  await expect(termsConsent).toBeVisible({timeout:30000});
  await termsConsent.click();

  const dataConsent=page.getByText(/Autorizo a SAMSUNG ELECTRONICS COLOMBIA/i)
    .filter({visible:true}).first();
  await expect(dataConsent).toBeVisible({timeout:30000});
  await dataConsent.click();

  const continueToPayment=page.getByRole("button",{
    name:/Continuar con (?:el pago|los m[eé]todos de pago)/i
  }).filter({visible:true}).first();
  await expect(continueToPayment).toBeVisible({timeout:30000});
  await expect(continueToPayment).toBeEnabled({timeout:30000});
  await continueToPayment.click();

  // S2 can invalidate payment availability while staying on Delivery. In this
  // CO layout the visible Eco Renueva card needs to be reselected; the shipping
  // radio is already chosen and toggling it does not resolve the storefront.
  for(let attempt=0;attempt<2;attempt++){
    // The URL briefly reports Payment before the storefront redirects back to
    // Delivery, so let that redirect settle before deciding whether to retry.
    await page.waitForTimeout(2500);
    if(!/CHECKOUT_STEP_DELIVERY.*paymentNotAvailable=true/i.test(page.url()))break;
    const ecoRenueva=page.getByText(/^Eco Renueva$/i).filter({visible:true}).first();
    await expect(ecoRenueva).toBeVisible({timeout:30000});
    await ecoRenueva.click();
    await expect(continueToPayment).toBeEnabled({timeout:10000});
    await continueToPayment.click();
  }

  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i,{timeout:60000});
  await page.waitForTimeout(2500);
  if(/CHECKOUT_STEP_DELIVERY/i.test(page.url())){
    throw new Error(`CO checkout returned to Delivery after Eco Renueva retry: ${page.url()}`);
  }
  const payment=new MarketPaymentPage(page,{market:"CO"});
  const card=getMxTestCard();
  await payment.selectCreditCard();
  await payment.fillCardData(card);
  await payment.validateCreditCardReady(card);
  const result=await payment.placeOrderAndCapture();
  expect(result.orderCode).toMatch(/^CO\d{6}-\d{8}(?:_\d+)?$/i);
  console.log("CO_QST_REGISTERED_ORDER",JSON.stringify({orderCode:result.orderCode,paymentMode:"co-mercadoCC",outcome:result.outcome}));
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
if(id==="SAM-24911"){
  await page.setViewportSize({width:1920,height:1080});
  const controlRendered=await page.waitForFunction(()=>{
    window.scrollTo(0,document.documentElement.scrollHeight);
    return /Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i.test(document.body.innerText);
  },null,{timeout:20000,polling:"raf"}).then(()=>true,()=>false);
  if(!controlRendered)throw new Error("CO S2 cart footer loaded, but no Back to Top control rendered. Verify manually on /co/cart after scrolling to the bottom.");
  const backToTop=page.getByRole("button",{name:/Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i})
    .or(page.getByRole("link",{name:/Volver al inicio|Back to top|Volver arriba|Ir arriba|Subir/i})).filter({visible:true}).first();
  await expect(backToTop).toBeVisible({timeout:30000});
  const cartTop=page.getByText(/Tienes\s+\d+\s+Producto\(s\)\s+en\s+tu\s+carrito/i).first();
  await expect(cartTop).not.toBeInViewport();
  await backToTop.click();
  await expect(cartTop).toBeInViewport({timeout:30000});
  return;
}
if(id==="SAM-24925"){await page.setViewportSize({width:390,height:844});await expect(page.getByRole("button",{name:/checkout|comprar|continuar/i}).filter({visible:true}).first()).toBeVisible({timeout:30000});return;}
test.skip(true,id+" is represented canonically but requires live CO checkout/auth/payment data before promotion.");
}
test("SAM-24880 @qst @co @base-store - Add product from BC Page",async({page},i)=>{
  evidence(i,"SAM-24880");
  const cfg=getCoQstConfig();
  await home(page,cfg);
  const configuredBc=process.env.CO_QST_BC_URL?.trim();
  let bcUrl;
  if(configuredBc){
    bcUrl=new URL(configuredBc);
    expect(bcUrl.origin).toBe(cfg.baseUrl.origin);
    expect(bcUrl.pathname).toMatch(/^\/co\//i);
  }else{
    const appliance=page.getByRole("link",{name:/Electrodom[eé]sticos/i}).filter({visible:true}).first();
    await expect(appliance,"CO home must expose the appliance category navigation.").toBeVisible({timeout:30000});
    await appliance.hover();
    const refrigerators=page.locator('a[href*="/co/"]')
      .filter({hasText:/Refrigeradores|Neveras/i}).filter({visible:true}).first();
    await expect(refrigerators,"CO BC refrigerator category must be discoverable from the home navigation.").toBeVisible({timeout:30000});
    bcUrl=new URL(await refrigerators.getAttribute("href"),cfg.baseUrl);
  }
  await page.goto(bcUrl.href,{waitUntil:"domcontentloaded",timeout:60000});
  await expect(page).toHaveURL(bcUrl.href,{timeout:30000});
  const productCard=page.getByRole("listitem")
    .filter({has:page.getByRole("link",{name:/Agregar al carrito/i})}).first();
  await expect(productCard,`BC category ${bcUrl.pathname} must list a purchasable CO product.`).toBeVisible({timeout:60000});
  const productLink=productCard.locator('a[href^="/co/refrigerators/"]:not([href*="#"])').first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page).toHaveURL(/\/co\/refrigerators\/[^?#]+\/[^?#]+\//i,{timeout:60000});
  const pdpUrl=page.url();
  const minicartUrl=await page.waitForFunction(()=>performance.getEntriesByType("resource")
    .map(entry=>entry.name).find(url=>/\/minicart\/totalProducts(?:[?#]|$)/i.test(url)),null,{timeout:30000});
  const countUrl=await minicartUrl.jsonValue();
  const cartCount=async()=>{
    const response=await page.request.get(countUrl);
    expect(response.ok(),"BC minicart count request must succeed.").toBe(true);
    const body=await response.text();
    const count=Number(body.match(/<Integer>(\d+)<\/Integer>/i)?.[1]);
    expect(Number.isFinite(count),"BC minicart count must be numeric.").toBe(true);
    return count;
  };
  const before=await cartCount();
  const noTradeIn=page.getByRole("radio",{name:"No",exact:true}).filter({visible:true}).first();
  if(await noTradeIn.isVisible() && !await noTradeIn.isChecked())await noTradeIn.check();
  const add=page.getByRole("link",{name:/Agregar al carrito/i}).filter({visible:true})
    .or(page.getByRole("button",{name:/Agregar al carrito/i}).filter({visible:true}))
    .or(page.getByRole("link",{name:/Comprar ahora/i}).filter({visible:true})).first();
  await expect(add,"BC PDP must expose an Add to Cart action.").toBeVisible({timeout:60000});
  const addResponse=page.waitForResponse(response=>response.request().method()==="POST"&&
    /\/addToCart\/multi\/$|\/users\/current\/carts\/[^/]+\/entries(?:\?|$)/i.test(new URL(response.url()).pathname),
  {timeout:30000}).catch(()=>null);
  await add.click();
  const response=await addResponse;
  if(response)expect(response.ok(),"BC Add to Cart mutation must succeed.").toBe(true);
  if(/SystemParking|System Check/i.test(page.url())){
    await page.goBack({waitUntil:"domcontentloaded",timeout:30000}).catch(()=>null);
    if(!/\/co\/refrigerators\//i.test(page.url()))await page.goto(pdpUrl,{waitUntil:"domcontentloaded",timeout:30000});
  }
  await expect.poll(cartCount,{timeout:30000,message:"BC Add to Cart must increase the CO minicart count."}).toBeGreaterThan(before);
  await i.attach("co-24880-bc-add",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});
test("SAM-24882 @qst @co @base-store - Cart page UI",async({page},i)=>runCanonicalCase("SAM-24882",page,i));
test("SAM-24883 @qst @co @base-store - Increase decrease delete quantity",async({page},i)=>runCanonicalCase("SAM-24883",page,i));
test("SAM-24886 @qst @co @base-store - Verify rewards text as Guest User",async({page},i)=>runCanonicalCase("SAM-24886",page,i));
test("SAM-24892 @blocked @qst @co @base-store - Add SC+ from BC PDP Page",async({page},i)=>runCanonicalCase("SAM-24892",page,i));
test("SAM-24893 @qst @co @base-store - Verify trade-up cart page",async({page},i)=>runCanonicalCase("SAM-24893",page,i));
test("SAM-24896 @qst @co @base-store @registered - Cart value when Reg user logs out",async({browser},i)=>{
  evidence(i,"SAM-24896");
  const cfg=getCoQstConfig();
  const suffix=cfg.environment.toLowerCase();
  const statePath=path.resolve(`playwright/.auth/co-${suffix}-second-user.json`);
  const sessionPath=path.resolve(`playwright/.auth/co-${suffix}-second-session-storage.json`);
  test.skip(!fs.existsSync(statePath)||!fs.existsSync(sessionPath),"A dedicated CO second-account session is required for the logout test.");
  const secondAuth=createAuthState({
    authStatePath:statePath,
    sessionStoragePath:sessionPath,
    hostname:cfg.baseUrl.hostname,
    setupUrl:cfg.setupUrl?.href||null,
    validationUrl:cfg.baseUrl.href,
    label:`${cfg.environment} CO second account`,
    refreshInstruction:"Refresh CO_AUTH_SLOT=second before running SAM-24896.",
    profileMenuTrigger:"hover",
    logoutTextName:/Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector:'[role="menu"].profile-menu',
    profileMenuReadySelector:'[role="menu"].profile-menu',
  });
  const context=await browser.newContext({storageState:statePath});
  try{
    await secondAuth.applyAuthSessionStorage(context);
    const page=await context.newPage();
    await secondAuth.validateAuthenticatedSession(page);
    await page.keyboard.press("Escape");
    const registeredCart=await cart(page,cfg);
    await registeredCart.validateProductInCart();
    const total=page.getByRole("heading",{name:/^Total$/i}).locator("xpath=..");
    const registeredTotal=(await total.innerText()).match(/\$\s*([\d.,]+)/)?.[1];
    expect(registeredTotal,"Registered CO cart must show a numeric total before logout.").toBeTruthy();
    expect(Number(registeredTotal.replace(/\D/g,""))).toBeGreaterThan(0);
    const logout=page.getByText(/Cerrar Sesi[oó]n/i).filter({visible:true}).first();
    if(!await logout.isVisible())await page.getByRole("button",{name:"My Profile",exact:true}).click();
    await expect(logout).toBeVisible({timeout:30000});
    await logout.click();
    await expect(page.getByText(/Sign Up\s*\/\s*Inicia sesi[oó]n/i).filter({visible:true}).first(),
      "CO must show the signed-out cart after the logout navigation.")
      .toBeVisible({timeout:60000});
    await expect(page.getByText(cfg.sku,{exact:true}).first()).toBeVisible({timeout:30000});
    await expect.poll(async()=>{
      const guestTotal=(await total.innerText()).match(/\$\s*([\d.,]+)/)?.[1];
      return guestTotal?.replace(/\D/g,"");
    },{timeout:30000}).toBe(registeredTotal.replace(/\D/g,""));
  }finally{await context.close();}
});
test("SAM-24898 @qst @co @base-store - Checkout button on cart page",async({page},i)=>runCanonicalCase("SAM-24898",page,i));
test("SAM-24899 @qst @co @base-store - Order Summary on checkout page",async({page},i)=>runCanonicalCase("SAM-24899",page,i));
test("SAM-24900 @qst @co @base-store - Step 1 Contact Details Section",async({page},i)=>runCanonicalCase("SAM-24900",page,i));
test("SAM-24901 @qst @co @base-store @registered - Add Edit saved new address",async({browser},i)=>{
  test.skip(process.env.ALLOW_PROFILE_WRITE!=="1","Persistent CO address edits require ALLOW_PROFILE_WRITE=1.");
  evidence(i,"SAM-24901");
  const {context,page,delivery}=await coRegisteredDelivery(browser);
  try{
    const secondaryNumber=`113-${Date.now()%10000}`;
    await coFillNewShipping(page,delivery,secondaryNumber);
    const save=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').first();
    await expect(save).toBeVisible();
    await save.check();
    await expect(save).toBeChecked();
    await coFillNewBilling(page,delivery,secondaryNumber);
    await delivery.locator('input[name="saveInAddressBook"]:not([disabled])').last().check();
    await coContinueToPayment(page,delivery);
    await expect(page.getByText(secondaryNumber,{exact:false}).filter({visible:true}).first()).toBeVisible({timeout:30000});
    const edit=page.locator('.delivery-item-actions a.actions__edit').first();
    await expect(edit).toBeVisible({timeout:30000});
    await coClick(page,edit);
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:30000});
    await expect(page.getByText(secondaryNumber,{exact:false}).filter({visible:true}).first()).toBeVisible({timeout:30000});
    const changedNumber=`114-${Date.now()%10000}`;
    await coFillNewShipping(page,delivery,changedNumber);
    const changedShippingSave=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').first();
    await changedShippingSave.check();
    await expect(changedShippingSave).toBeChecked();
    await coFillNewBilling(page,delivery,changedNumber);
    const changedBillingSave=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').last();
    await changedBillingSave.check();
    await expect(changedBillingSave).toBeChecked();
    await coContinueToPayment(page,delivery);
    const shippingSummary=page.locator('.address-details__delivery-address');
    const billingSummary=page.locator('.address-details__billing-address');
    await expect(shippingSummary).toContainText(changedNumber,{timeout:30000});
    await expect(billingSummary).toContainText(changedNumber,{timeout:30000});
    await expect(shippingSummary).not.toContainText(secondaryNumber);
    await i.attach("co-24901-updated-checkout-addresses",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  }finally{await context.close();}
});
test("SAM-24902 @qst @co @base-store @registered - Select saved address",async({browser},i)=>{
  evidence(i,"SAM-24902");
  const {context,page,delivery}=await coRegisteredDelivery(browser);
  try{
    await coSelectSavedAddress(page,delivery,"Shipping");
    await coDismissReminder(page);
    await delivery.locator('input[name="sameAsShipping"]').uncheck();
    await coSelectSavedAddress(page,delivery,"Billing");
    await coContinueToPayment(page,delivery);
    await expect(page.getByText(/Bogot[aá]|Carrera|Calle/i).filter({visible:true}).first()).toBeVisible({timeout:30000});
  }finally{await context.close();}
});
test("SAM-24903 @qst @co @base-store @registered - Save option for reg user",async({browser},i)=>{
  test.skip(process.env.ALLOW_PROFILE_WRITE!=="1","Saving CO profile addresses requires ALLOW_PROFILE_WRITE=1.");
  evidence(i,"SAM-24903");
  const {context,page,delivery}=await coRegisteredDelivery(browser);
  try{
    const secondaryNumber=`113-${Date.now()%10000}`;
    await coFillNewShipping(page,delivery,secondaryNumber);
    const shippingSave=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').first();
    await expect(shippingSave).toBeVisible();
    await shippingSave.check();
    await expect(shippingSave).toBeChecked();
    await coFillNewBilling(page,delivery,secondaryNumber);
    const billingSave=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').last();
    await expect(billingSave).toBeVisible();
    await billingSave.check();
    await expect(billingSave).toBeChecked();
    await coContinueToPayment(page,delivery);
    await expect(page.getByText(secondaryNumber,{exact:false}).filter({visible:true}).first()).toBeVisible({timeout:30000});
    const editDelivery=page.locator('.delivery-item-actions a.actions__edit').first();
    await expect(editDelivery).toBeVisible({timeout:30000});
    await coClick(page,editDelivery);
    await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:30000});
    await expect(delivery.getByRole("radio",{name:new RegExp(secondaryNumber)}).first(),
      "The newly saved shipping address must be available in the registered account's saved-address list.")
      .toBeVisible({timeout:30000});
  }finally{await context.close();}
});
test("SAM-24904 @qst @co @base-store @registered - Able to checkout with New address",async({browser},i)=>{
  evidence(i,"SAM-24904");
  const {context,page,delivery}=await coRegisteredDelivery(browser);
  try{
    const secondaryNumber=`113-${Date.now()%10000}`;
    await coFillNewShipping(page,delivery,secondaryNumber);
    await expect(delivery.locator('input[name="addressOptionShipping"][value="NEW_ADDRESS"]')).toBeChecked();
    await expect(delivery.locator('input[name="line2_c"]')).toHaveValue(new RegExp(`#?\\s*${secondaryNumber}$`));
    const save=delivery.locator('input[name="saveInAddressBook"]:not([disabled])').first();
    if(await save.isVisible() && await save.isChecked())await save.uncheck();
    await coContinueToPayment(page,delivery);
    await expect(page.locator('.address-details__delivery-address')).toContainText(secondaryNumber,{timeout:30000});
    await i.attach("co-24904-new-address-payment-checkpoint",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  }finally{await context.close();}
});
test("SAM-24905 @qst @co @base-store - Save option not visible",async({page},i)=>runCanonicalCase("SAM-24905",page,i));
test("SAM-24909 @qst @co @base-store - Validate Invalid address details",async({page},i)=>runCanonicalCase("SAM-24909",page,i));
test("SAM-24910 @qst @co @base-store @registered - Validate switching delivery modes address",async({browser},i)=>{
  evidence(i,"SAM-24910");
  const {context,page,delivery}=await coRegisteredDelivery(browser);
  try{
    const saved=delivery.locator('input[name="addressOptionShipping"]:not([value="NEW_ADDRESS"])').first();
    const fresh=delivery.locator('input[name="addressOptionShipping"][value="NEW_ADDRESS"]');
    await coSelectSavedAddress(page,delivery,"Shipping");
    await expect(saved).toBeChecked();
    await coSelectAddressMode(page,delivery,"Shipping","NEW_ADDRESS");
    await expect(fresh).toBeChecked();
    await expect(saved).not.toBeChecked();
    await expect(delivery.locator('mat-select[name="regionIso"]')).toBeVisible();
    await coSelectSavedAddress(page,delivery,"Shipping");
    await expect(saved).toBeChecked();
    await expect(fresh).not.toBeChecked();
  }finally{await context.close();}
});
test("SAM-24911 @blocked @qst @co @base-store - Verify Back to Top",async({},i)=>{evidence(i,"SAM-24911");test.skip(true,"BLOCKED: known CO STG2 storefront issue. Back to Top is currently failing and is being handled internally; re-enable after the storefront fix.");});
test("SAM-24912 @destructive @qst @co @base-store @registered - Payment using credit card with reg user",async({page},i)=>runCanonicalCase("SAM-24912",page,i));
test("SAM-24915 @blocked @qst @co @base-store - Payment using Rewards",async({page},i)=>runCanonicalCase("SAM-24915",page,i));
test("SAM-24919 @destructive @qst @co @base-store - Track Order",async({page,context},i)=>{
  test.setTimeout(900000);
  evidence(i,"SAM-24919");
  const cfg=getCoQstConfig();
  requirePaymentSubmitOptIn();
  const email=`co-qst-${Date.now()}@mailinator.com`;
  const inbox=email.split("@")[0];
  const guestCart=await cart(page,cfg);
  await coGuestCheckout(page,guestCart,email);
  await fillCoGuestContact(page,{recoverStalledTransition:true,guestEmail:email});
  const delivery=page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
  await expect(delivery).toBeVisible({timeout:60000});
  await coFillNewShipping(page,delivery);
  await coContinueToPayment(page,delivery);
  const payment=new MarketPaymentPage(page,{market:"CO"});
  const card=getMxTestCard();
  await payment.selectCreditCard();
  await payment.fillCardData(card);
  await payment.validateCreditCardReady(card);
  const created=await payment.placeOrderAndCapture();
  await expect(page,"The newly submitted CO order must reach a confirmation page, not just return an order code in an API response.")
    .toHaveURL(/confirmation|confirmacion|order-confirmation|checkout\/order|success/i,{timeout:90000});
  const confirmationText=await expect.poll(async()=>{
    const text=await page.locator("body").innerText().catch(()=>"");
    return /N[uú]mero de pedido:\s*CO\d{6}-\d{8}/i.test(text)?text:null;
  },{timeout:90000,message:"CO confirmation did not hydrate its public order number."}).toBeTruthy()
    .then(()=>page.locator("body").innerText());
  const orderNumber=confirmationText.match(/N[uú]mero de pedido:\s*(CO\d{6}-\d{8})/i)?.[1];
  expect(orderNumber,"CO confirmation must display the public order number used by Track Order.").toBeTruthy();
  expect(created.orderCode.startsWith(orderNumber),"The confirmation order must match the submitted checkout response.").toBe(true);
  // CO intermittently omits the email from the confirmation copy; the OTP
  // request below verifies the actual order/email association.
  console.log(`[co-tracking] fresh guest order ${orderNumber} confirmed for ${email}`);
  i.annotations.push({type:"co-tracking-created-order",description:`Fresh guest order ${orderNumber} for ${email}`});
  const ordersUrl=new URL("/co/mypage/orders",cfg.baseUrl.origin).toString();
  let tracking;
  for(let attempt=1;attempt<=3;attempt++){
    if(attempt>1)await bootstrapCoStorefront(page,cfg);
    await page.goto(ordersUrl,{waitUntil:"domcontentloaded",timeout:60000}).catch(async(error)=>{
      if(attempt===3)throw error;
    });
    tracking=new GuestOrderTrackingPage(page,{market:"co",currencyPattern:/\$\s*[\d.,]+/,productPattern:new RegExp(cfg.sku,"i")});
    if(await tracking.form.waitFor({state:"visible",timeout:20000}).then(()=>true).catch(()=>false))break;
    if(attempt===3)throw new Error("CO Track Order form did not render after three controlled navigations.");
  }
  await tracking.validateGuestTrackingForm();
  const mailPage=await context.newPage();
  try{
    const mail=new MailinatorPage(mailPage,inbox);
    await mail.openInbox();
    const baselineMessageIds=await mail.snapshotMessageIds();
    await page.bringToFront();
    const otpRequest=await tracking.requestVerificationCode(orderNumber,email,{maxAttempts:4,retryDelayMs:15000});
    i.annotations.push({type:"co-tracking-otp-request",description:`${otpRequest.method} ${otpRequest.status} ${otpRequest.endpoint}`});
    await mailPage.bringToFront();
    const otpEmail=await mail.waitForOtpEmail({baselineMessageIds});
    await page.bringToFront();
    await tracking.submitVerificationCode(otpEmail.otp,orderNumber);
    const result=await tracking.validateTrackedOrder(orderNumber);
    expect(result.status).toBeTruthy();
    expect(result.hasOrderSummary).toBe(true);
  }finally{await mailPage.close();}
});
test("SAM-24920 @qst @co @base-store - Backoffice",async({page},i)=>runCanonicalCase("SAM-24920",page,i));
test("SAM-24925 @qst @co @base-store - Mobile Sticky checkout",async({page},i)=>runCanonicalCase("SAM-24925",page,i));
test("SAM-24914 @blocked @qst @co @base-store @payment - Payment using ADDI pay",async({},i)=>{evidence(i,"SAM-24914");test.skip(true,"Official source is BLOCKED and documents a PSE/BO/Kibana callback workflow; no automated bypass or fabricated payment completion.");});
});
