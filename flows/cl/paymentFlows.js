import { test, expect } from "@playwright/test";
import MarketPaymentPage from "../../pages/MarketPaymentPage";
import clTestCard from "../../utils/clTestCard.cjs";
import destructiveGuards from "../../utils/destructiveGuards";
import { installBusinessNetworkEvidence } from "../../utils/businessNetworkEvidence";
import evidenceContext from "../../reporting/evidence/evidenceContext.js";

const { recordBusinessEvidence } = evidenceContext;
const CL_S2_RT_751761_BLOCKED_IDS = new Set([
  "SAM-24823",
  "SAM-24824",
]);

function blockClS2OrderClosureKnownDefect(testInfo, environment) {
  const samId = testInfo.title.match(/SAM-\d+/)?.[0];
  if (environment !== "S2" || !CL_S2_RT_751761_BLOCKED_IDS.has(samId)) return;

  recordBusinessEvidence(testInfo, {
    market: "CL",
    environment,
    knownDefect: "RT-751761",
    blockedReason: "CL S2 order creation/confirmation is currently unavailable.",
    paymentFailureClassification: "KNOWN_DEFECT",
  });
  testInfo.annotations.push({
    type: "known-defect",
    description: "RT-751761 - CL S2 order creation/confirmation is currently blocked",
  });
  test.skip(true, "KNOWN DEFECT RT-751761: CL S2 cannot currently complete order creation/confirmation; payment/order-dependent official TCs are non-gating until the defect is resolved.");
}

export async function completeClFlowSandbox(page, { orderCode, storefrontOrigin }) {
  destructiveGuards.requirePaymentSubmitOptIn();
  const current = new URL(page.url());
  const target = new URL(storefrontOrigin);
  if (current.protocol !== "https:" || current.hostname !== "sandbox.flow.cl" ||
      target.protocol !== "https:" || !["stg.shop.samsung.com", "stg2.shop.samsung.com"].includes(target.hostname) ||
      !/^CL\d{6}-\d{8}(?:_\d+)?$/i.test(orderCode)) {
    throw new Error("CL Flow completion requires the genuine sandbox, a staging return and the exact existing CL order.");
  }
  await expect(page.getByText(/Sitio de pruebas de Flow/i)).toBeVisible();
  await expect(page.getByText(/Simulador de Pagos/i)).toBeVisible();
  await expect(page.locator("body")).toContainText(orderCode);
  const action = page.getByRole("combobox");
  await action.selectOption({ label: "Quiero pagar la orden" });
  await expect(action.locator("option:checked")).toHaveText("Quiero pagar la orden");
  await page.waitForFunction(() => {
    const button = document.getElementById("pagar");
    return Boolean(button) && typeof window.jQuery?._data === "function" &&
      Boolean(window.jQuery._data(button, "events")?.click?.length);
  }, null, { timeout: 60000 });
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await page.waitForURL(url => url.origin === target.origin && url.pathname.startsWith("/cl/"), { timeout: 90000 });
}

export async function completeClRegisteredContact(page,customer={}) {
  await expect(page).toHaveURL(/CHECKOUT_STEP_(CONTACT_INFO|DELIVERY)/i,{timeout:60000});
  if(!/CHECKOUT_STEP_CONTACT_INFO/i.test(page.url()))return;
  const contact=page.locator('[data-activestepname="CHECKOUT_STEP_CONTACT_INFO"]');
  for(const [name,fallback] of [['firstName',customer.firstName||'Cliente'],['lastName',customer.lastName||'Prueba'],['phone',customer.phone||'987654321']]){
    const field=contact.locator(`input[name="${name}"]:visible`).first();
    if(!(await field.inputValue()).trim())await field.fill(fallback);
  }
  const document=contact.locator('input[name="vatNumber"]:visible').first();
  if(await document.count()){
    const value=(await document.inputValue()).replace(/\./g,'');
    if(!/^\d{7,8}-[\dkK]$/.test(value))await document.fill(customer.documentNumber||'12345678-5');
  }
  await contact.getByRole('button',{name:/Continuar a despacho/i}).click();
  await expect(page).toHaveURL(/CHECKOUT_STEP_DELIVERY/i,{timeout:60000});
}

export async function continueClRegisteredDeliveryToPayment(page,{addressReady=false,diagnose=false,storefront=null}={}) {
  const exchanges=[];
  const observe=response=>{const u=new URL(response.url());if(response.request().method()==='POST'&&/^s[12]-smb-api-cdn\.ecom-stg\.samsung\.com$/.test(u.hostname))exchanges.push({path:u.pathname.replace(/\/users\/[^/]+\//,'/users/[identity]/'),status:response.status()});};
  if(diagnose)page.on('response',observe);
  try{
  if(!addressReady){
  const saved = page.getByRole("radio", { name: /Mis direcciones/i });
  if(!await saved.isChecked())await saved.locator("xpath=ancestor::mat-radio-button[1]").click();
  await expect(saved).toBeChecked();
  }
  const shipping = page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
  const delivery = shipping.getByText(/Entrega d[ií]a siguiente|Despacho est[aá]ndar/i)
    .filter({ visible: true }).first();
  await expect(delivery).toBeVisible({ timeout: 30000 });
  if(storefront){
    const site=storefront.apiSite||storefront.rootUrl.pathname.split('/').filter(Boolean)[2];
    const origin=`https://${storefront.environment.toLowerCase()}-smb-api-cdn.ecom-stg.samsung.com`;
    // The checked radio/updated price is optimistic. Continue must wait for
    // the native delivery save to complete; never replay a payment or POST.
    const saved=page.waitForResponse(response=>{const u=new URL(response.url());return response.request().method()==='POST'&&u.origin===origin&&u.pathname===`/tokocommercewebservices/v2/${site}/users/current/carts/current/deliverymodes/update`;},{timeout:60000});
    const [response]=await Promise.all([saved,delivery.click()]);
    if(!response.ok()||await response.finished())throw new Error('CL EPP delivery persistence failed; no payment submitted.');
  }else await delivery.click();
  // EPP exposes the same legal choice by its accessible label, while the
  // native input name differs from Base Store. Scope to Delivery and avoid
  // selecting the unrelated subscription or invoice checkboxes.
  const terms = shipping.getByRole('checkbox', { name: /^Acepto los t[eé]rminos y condiciones/i });
  if (!(await terms.isChecked())) await terms.check({ force: true });
  await page.getByRole("button", { name: /Continuar al pago/i }).click();
  await expect(page).toHaveURL(/CHECKOUT_STEP_PAYMENT/i, { timeout: 60000 });
  }finally{
    if(diagnose){
      page.off('response',observe);
      const state=await page.evaluate(()=>({invalid:[...document.querySelectorAll('input:invalid,select:invalid,textarea:invalid')].map(e=>({name:e.name,type:e.type,visible:!!(e.getBoundingClientRect().width&&e.getBoundingClientRect().height),message:e.validationMessage})),radios:[...document.querySelectorAll('input[type="radio"]')].filter(e=>/delivery_mode_option/.test(e.name)).map(e=>({name:e.name,checked:e.checked})),errors:[...document.querySelectorAll('mat-error,[role="alert"]')].filter(e=>e.getBoundingClientRect().height).map(e=>e.textContent.trim().replace(/\S+@\S+/g,'[email]').replace(/\d{4,}/g,'[digits]'))}));
      await test.info().attach('CL EPP Delivery diagnostics',{body:JSON.stringify({exchanges,state}),contentType:'application/json'});
    }
  }
}

export async function selectClInterestFreeInstallments(payment, testInfo) {
  const control = payment.installmentsCombobox;
  await expect(control).toBeVisible({ timeout: 30000 });
  const options = await control.locator("option").evaluateAll(items => items
    .filter(option => !option.disabled && option.value)
    .map(option => ({ value: option.value, text: option.textContent.trim() })));
  await testInfo.attach("CL Offered Installments", {
    body: JSON.stringify(options), contentType: "application/json",
  });
  const choice = options.find(option => /^\s*(?:[2-9]|\d{2,})\s+cuotas?\b/i.test(option.text) &&
    /sin\s+inter[eé]s|0\s*%/i.test(option.text));
  test.skip(!choice, "Missing CL interest-free installments test data: the selected test card does not offer an explicitly interest-free multi-installment option. One installment is not coverage for this TC.");
  await control.selectOption(choice.value);
  await expect(control).toHaveValue(choice.value);
  return choice;
}

export async function selectClNativePaymentButton(page, heading) {
  const method = page.getByRole("button").filter({
    has: page.getByRole("heading", { name: heading }),
  }).filter({ visible: true }).first();
  await expect(method).toBeVisible({ timeout: 60000 });
  if (await method.getAttribute("aria-expanded") !== "true") await method.click();
  await expect(method).toHaveAttribute("aria-expanded", "true");
  const panel = method.locator("xpath=ancestor::mat-expansion-panel[1]");
  const button = panel.getByRole("button", { name: /realizar pedido|pagar ahora/i })
    .filter({ visible: true });
  await expect(button).toBeVisible({ timeout: 60000 });
  await expect(button).toBeEnabled();
  return button;
}

export async function executeClPaymentOrder(browser, testInfo, { reachDelivery, kind = "card" }) {
  const environment = String(process.env.CL_QST_ENVIRONMENT || process.env.TEST_ENV || "").toUpperCase();
  blockClS2OrderClosureKnownDefect(testInfo, environment);
  test.skip(process.env.ALLOW_PAYMENT_SUBMIT !== "1", "Set ALLOW_PAYMENT_SUBMIT=1 to authorize a CL test order.");
  const cardProvider = String(process.env.CL_QST_CARD_PROVIDER || (environment === "S2" ? "mercado" : "webpay")).toLowerCase();
  if (!["webpay", "mercado"].includes(cardProvider)) throw new Error("CL_QST_CARD_PROVIDER must be webpay or mercado.");
  const flowCard = kind === "card" && cardProvider === "webpay";
  const paymentMode = flowCard ? "Webpay Credit / Debit Card" :
    kind === "transfer" ? "Direct Bank Transfer" :
      kind === "installments" ? "Interest-free installments" : "Credit / Debit Card";
  recordBusinessEvidence(testInfo, {
    market: "CL",
    environment: environment || null,
    paymentMode,
    authorizedSubmit: true,
  });

  const { context, page } = await reachDelivery(browser, { singleItem: true, paymentProduct: true });
  installBusinessNetworkEvidence(page, testInfo, "CL");
  try {
    await test.step("Choose the registered delivery address and continue to CL Payment", async () => {
      await continueClRegisteredDeliveryToPayment(page);
    });
    const payment = new MarketPaymentPage(page, { market: "CL" });
    if (kind === "transfer" || flowCard) {
      await test.step(flowCard ? "Select native CL Webpay credit/debit card payment" : "Select the native CL bank transfer payment method", async () => {
        const heading = flowCard ? /^Tarjetas de Cr[eé]dito y D[eé]bito \(Webpay\)$/i : /^Transferencia Bancaria$/i;
        payment.placeOrderButton = await selectClNativePaymentButton(page, heading);
      });
    } else {
      await test.step("Populate and validate the selected CL sandbox card", async () => {
        let card;
        try { card = clTestCard.getClTestCard(); } catch (error) {
          if (error.code !== "CL_TEST_CARD_DATA_REQUIRED") throw error;
          test.skip(true, "Missing CL sandbox card test data: provision CL_TEST_CARD_* or the ignored CL card fixture. MX card data must not be borrowed.");
        }
        await payment.selectCreditCard();
        await payment.fillCardData(card);
        await payment.validateCreditCardReady(card);
        if (kind === "installments") await selectClInterestFreeInstallments(payment, testInfo);
      });
    }
    await test.step("Submit once and prove a new Samsung order confirmation", async () => {
      const storefrontOrigin = new URL(page.url()).origin;
      const result = await payment.placeOrderAndCapture(kind === "transfer" || flowCard ? {
        submitResponsePathPattern: /^\/tokocommercewebservices\/v2\/cl\/users\/[^/]+\/carts\/[^/]+\/paymentmodes\/cl-[^/]+\/submitOrder$/i,
      } : {});
      expect(result.orderCode).toMatch(/^CL\d{6}-\d{8}(?:_\d+)?$/i);
      const publicOrderCode = result.orderCode.replace(/_\d+$/, "");
      if (new URL(page.url()).hostname === "sandbox.flow.cl") {
        await completeClFlowSandbox(page, { orderCode: result.orderCode, storefrontOrigin });
      }
      await expect(page).toHaveURL(/confirmation|confirmacion|order-confirmation|checkout\/order|success/i, { timeout: 90000 });
      await expect(page.getByText(publicOrderCode, { exact: false }).first()).toBeVisible({ timeout: 30000 });

      recordBusinessEvidence(testInfo, {
        orderCode: result.orderCode,
        publicOrderCode,
        paymentMode,
        outcome: result.outcome,
        authorizedSubmit: true,
      });
      await testInfo.attach("CL Order Evidence", {
        body: Buffer.from(JSON.stringify({
          market: "CL",
          environment: environment || null,
          orderId: result.orderCode,
          publicOrderCode,
          paymentMode,
          outcome: result.outcome,
          finalUrl: result.finalUrl,
          responses: result.responses || [],
          authorizedSubmit: true,
          confirmationValidated: true,
        }, null, 2)),
        contentType: "application/json",
      });
      testInfo.annotations.push({ type: "cl-qst-order", description: result.orderCode });
    });
  } finally {
    await context.close();
  }
}
