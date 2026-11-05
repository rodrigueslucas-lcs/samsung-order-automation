import { expect, test } from "@playwright/test";
import ProductPage from "../pages/ProductPage";
import CartPage from "../pages/CartPage";
import accessState from "../utils/eppAccessState.cjs";
import business from "../utils/eppBusinessAssertions.cjs";
import serverProof from "../utils/eppServerProof.cjs";
import mxReadback from '../utils/mxCartReadback.cjs';
import eppOverlays from '../utils/eppStorefrontOverlays.cjs';

function enforceEppQst(condition, reason, cfg) {
  if (!condition) return;
  // Chile S2 homologation reports an actual FAIL, never a concealed SKIP.
  // A failed auth or entitlement remains blocked; it is not bypassed.
  if (cfg?.market === 'CL' && cfg.environment === 'S2') {
    throw new Error(reason);
  }
  test.skip(true, reason);
}

const CODE_INPUT = /verification|verify|access code|c[oó]digo|clave de acceso/i;
const CODE_BUTTON = /verify|continue|enter|submit|access|ingresar|continuar|validar|acceder/i;

export async function openEppStore(page, cfg) {
  await eppOverlays.installEppOverlayDismissal(page,cfg);
  const entry = new URL(cfg.entryUrl);
  if (entry.origin !== cfg.rootUrl.origin || !entry.pathname.startsWith(cfg.rootUrl.pathname) || entry.username || entry.password) {
    throw new Error("EPP entry must remain inside the configured staging multistore.");
  }
  await page.goto(new URL("/getcookie.html", cfg.rootUrl).href, { waitUntil: "commit", timeout: 30000 });
  await expect(page.getByText(/You can access pages now/i).first()).toBeVisible({ timeout: 15000 });
  await page.goto(cfg.entryUrl.href, { waitUntil: "commit", timeout: 60000 });

  // Hydration, not DOMContentLoaded, determines whether the gate/content exists.
  await expect.poll(async () => {
    await eppOverlays.dismissEppNotificationTutorial(page,cfg);
    const state = await inspectEppAccess(page, cfg);
    return ["READY", "CODE_REQUIRED", "HUMAN_REQUIRED"].includes(state.status) || ['OUTSIDE_EPP_STORE','VERIFICATION_CODE_REJECTED'].includes(state.reason);
  }, { timeout: 45000 }).toBeTruthy().catch(() => {});
  const initial = await inspectEppAccess(page,cfg);
  enforceEppQst(['BLOCKED','HUMAN_REQUIRED'].includes(initial.status), `BLOCKED: ${cfg.market} ${cfg.environment} EPP ${initial.status}: ${initial.reason}; no login/code retry.`,cfg);

  if (cfg.accessMode === "verification-code" && cfg.verificationCode) {
    const candidate = page.getByRole("textbox", { name: CODE_INPUT })
      .or(page.getByPlaceholder(CODE_INPUT))
      .filter({ visible: true })
      .first();

    if (await candidate.isVisible().catch(() => false)) {
      // Never put the store code in a Samsung Account password input.
      if (new URL(page.url()).origin !== cfg.rootUrl.origin) throw new Error("EPP access left the configured staging origin.");
      await candidate.fill(cfg.verificationCode).catch(() => { throw new Error("EPP verification-code input failed."); });
      const submit = page.getByRole("button", { name: CODE_BUTTON }).filter({ visible: true }).first();
      if (await submit.isVisible().catch(() => false)) await submit.click();
      else await candidate.press("Enter");
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }

  if (cfg.accessMode === "corporate-email-link") {
    const email = page.locator('input[type="email"]:visible').first();
    if (await email.isVisible().catch(() => false)) {
      enforceEppQst(true, `BLOCKED: ${cfg.market} ${cfg.environment} EPP requires corporate-email activation before automation can continue.`,cfg);
    }
  }

  let confirmationAttempted = false;
  await expect.poll(async () => {
    const confirmation = confirmationAttempted ? null : await accessState.findEppVerifiedContinue(page);
    if (confirmation) {
      confirmationAttempted = true;
      await confirmation.click();
    }
    return (await inspectEppAccess(page, cfg)).status;
  }, { timeout: 30000 }).toBe("READY").catch(() => {});
  const state = await inspectEppAccess(page, cfg);
  if (state.status !== "READY") {
    test.info().annotations.push({ type: 'epp-prerequisite', description: `${state.status}: ${state.reason}` });
    enforceEppQst(true, `BLOCKED: ${cfg.market} ${cfg.environment} EPP ${state.status}: ${state.reason}`,cfg);
  }
}

export async function validateEppLogin(page, cfg) {
  const proof = serverProof.watchEppServerProof(page.context(), cfg);
  try {
    await openEppStore(page, { ...cfg, entryUrl: cfg.rootUrl });
    await proof.settle();
    const state = proof.snapshot();
    enforceEppQst(!state.userAccepted || !state.accessAccepted, `BLOCKED: authenticated EPP identity/entitlement not proven (${state.reason})`,cfg);
    await expect(page).toHaveURL(cfg.rootUrl.href);
    const homepage = await inspectEppAccess(page, cfg);
    expect(homepage.reason).toBe('AUTHENTICATED_EPP_HOMEPAGE');
  } finally { proof.stop(); }
}

export async function validateEppVariants(page, cfg) {
  enforceEppQst(!cfg.pdpUrl||!cfg.sku, 'BLOCKED: MISSING_OR_UNPROVEN_EPP_PRODUCT for PDP variants.',cfg);
  await openEppStore(page, { ...cfg, entryUrl: cfg.pdpUrl });
  try { await business.provePdpVariantSelection(page,cfg); }
  catch(error){if(error.eppReason==='MISSING_OR_UNPROVEN_EPP_PRODUCT')enforceEppQst(true,error.eppReason,cfg);throw error;}
  await businessScreenshot(page,'epp-pdp-selected-variant');
}

export async function validateEppCheckout(page, cfg) {
  await business.proveCheckout(page, cfg);
}

export async function validateEppContact(page, cfg, customer) {
  await business.completeContact(page, cfg, customer);
}

async function businessScreenshot(page, name) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true,
    mask: [page.locator('input'), page.locator('[data-sensitive]')], animations: 'disabled' });
  await test.info().attach(name, { path, contentType: 'image/png' });
}

export async function inspectEppAccess(page, cfg) {
  return accessState.proveEppAccess(page, cfg);
}

export async function addConfiguredEppProduct(page, cfg, { currencyPattern = /[$S/]\s*[\d.,]+/, fromPlp = false, resetMxCart = false } = {}) {
  if (!cfg.pdpUrl || !cfg.sku) {
    throw new Error(`${cfg.market} ${cfg.environment} EPP needs ${cfg.market}_EPP_QST_PDP_URL and ${cfg.market}_EPP_QST_SKU for product/cart scenarios.`);
  }
  if(resetMxCart){
    if(cfg.market!=='MX')throw new Error('The controlled MX cart setup cannot target another market.');
    await openEppStore(page,{...cfg,entryUrl:cfg.pdpUrl||cfg.rootUrl});
    const cart=new CartPage(page,{cartUrl:cfg.cartUrl.href,storefront:cfg});cart.screenshot=name=>businessScreenshot(page,name);
    await cart.clearMxCartAndConfirmEmpty();
  }
  if (fromPlp) {
    enforceEppQst(!cfg.plpUrl, `BLOCKED: ${cfg.market} ${cfg.environment} EPP PLP is required for the official PLP-to-PDP step.`,cfg);
    await openEppStore(page, { ...cfg, entryUrl: cfg.plpUrl });
    await business.chooseConfiguredPdpFromPlp(page, cfg);
  } else await openEppStore(page, { ...cfg, entryUrl: cfg.pdpUrl });
  const product = new ProductPage(page, {
    setupUrl: null,
    sku: cfg.sku,
    pdpUrl: cfg.pdpUrl.href,
    cartUrl: cfg.cartUrl.href,
    reuseLoadedPdp: true,
    ...(cfg.market==='MX'?{cartReadback:(target,options)=>mxReadback.readMxCartSku(target,{...options,storefront:cfg})}:{}),
  });
  product.screenshot = name => businessScreenshot(page, name);
  await product.addConfiguredPdpToCart({ waitForCartMutation: true });
  business.assertStoreRoute(page.url(), cfg, /^cart\/?$/);
  const cart = new CartPage(page, {
    cartUrl: cfg.cartUrl.href,
    storefront: cfg,
    sku: cfg.sku,
    productNamePattern: null,
    currencyPattern,
    ...business.getEppCartTextPatterns(cfg.market),
    totalPattern: /^Total(?: con IVA)?$/i,
    footerAccountPattern: /Cuenta|Account/i,
    checkoutButtonPattern: /^Continuar$|^Finalizar Compra$|^Checkout$/i,
  });
  cart.screenshot = name => businessScreenshot(page, name);
  return cart;
}

export async function validateEppCartUi(cart,{market,environment,program}={}) {
  await cart.validateCartPage();
  await cart.validateProductInCart();
  const row = cart.page.locator('cx-cart-item, .cart-item, .cart-product').filter({ hasText: cart.sku }).first();
  await expect(row).toBeVisible();
  const image = row.locator('img').first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(row.getByRole('heading').first()).toBeVisible();
  await expect(row.getByText(cart.currencyPattern).first()).toBeVisible();
  await cart.validateOrderSummary();
  // PE exposes its legitimate guest/express choices when no account is active.
  // Cart UI may inspect that CTA; registered checkout must never click it as a substitute.
  const guestCheckout=market==='PE'?cart.page.getByRole('button',{name:/^Checkout como invitado$/i}):null;
  if(guestCheckout&&await guestCheckout.isVisible()&&!await cart.continueButton.isVisible()){
    await expect(guestCheckout).toBeEnabled();
    await cart.screenshot('epp-cart-guest-checkout-available');
  }else await cart.validateCheckoutButton();
  const footer = cart.page.getByRole('contentinfo');
  const headings=market==='CL'?[/^Productos$/i,/^Tiendas$/i,/^Soporte$/i,/^Compa[nñ][ií]a$/i]:[/^Shop$|^Tienda$/i,/^Account$|^Cuenta$/i,/^Soporte$|^Support$/i];
  try{
    for(const name of headings)await expect(footer.getByRole('heading',{name})).toBeVisible({timeout:market==='CL'?15000:5000});
  }catch(error){
    const state={footers:await footer.count(),headings:await footer.getByRole('heading').filter({visible:true}).count(),links:await footer.getByRole('link').filter({visible:true}).count()};
    const observedProgramme=(market==='CL'&&program==='alianzas')||(market==='PE'&&program==='pe_membership_vip');
    if(observedProgramme&&environment==='S2'&&state.footers<=1&&state.headings===0&&state.links===0){
      await cart.screenshot('epp-cart-footer-missing');
      await test.info().attach('EPP empty footer signature',{body:JSON.stringify({market,environment,program,...state}),contentType:'application/json'});
      test.info().annotations.push({type:'known-defect',description:'SAM-25146: operator-linked empty cart footer'});
      enforceEppQst(true,'ENVIRONMENT_DEFECT: MISSING_EXPECTED_CART_FOOTER; known defect SAM-25146. Product, summary and checkout checks passed before the footer check.',{market,environment,program});
    }
    throw error;
  }
  await cart.screenshot('epp-cart-footer');
}

export async function validateBackToTop(page) {
  await business.proveTooltipAboveBackToTop(page);
}
