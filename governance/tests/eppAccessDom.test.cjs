const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");
const { observeEppAccess, findEppVerifiedContinue, eppAccountLoginAction } = require("../../utils/eppAccessState.cjs");
const rootUrl = new URL("https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/");
let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

async function observe(html, suffix = "registration") {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.route("**/*", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
    await page.goto(new URL(suffix, rootUrl).href);
    return await observeEppAccess(page, { rootUrl });
  } finally { await context.close(); }
}

test("real DOM recognizes the observed Material label without placeholder or aria-label", async () => {
  const state = await observe('<label for="mat-input-serverApp0">Código de verificación*</label><input id="mat-input-serverApp0" type="text"><button>Continuar</button>');
  assert.equal(state.status, "CODE_REQUIRED");
});
test("observed EPP product-detail-container proves rendered commerce on its PDP", async () => {
  const state = await observe('<main><cx-page-layout class="ProductDetailsPageTemplate"><div class="product-detail-container"><h1>Fixture phone</h1><button>Add to basket</button></div></cx-page-layout></main>', 'p/QA-SKU');
  assert.equal(state.status, 'READY');
});
test("real corporate-email form remains a human activation prerequisite", async () => {
  assert.equal((await observe('<label>Correo corporativo<input type="email"></label>')).reason, "CORPORATE_ACTIVATION_REQUIRED");
});
test('visible invalid-code rejection is a data blocker, not a generic timeout', async () => {
  const state = await observe('<label>Código de verificación<input type="text"></label><mat-error>Por favor, introduce un código de verificación válido</mat-error>');
  assert.deepEqual(state,{status:'BLOCKED',reason:'VERIFICATION_CODE_REJECTED'});
});
test("real rendered shell cannot masquerade as access", async () => {
  assert.equal((await observe('<main>Skip to Header Skip to Main Content Copyright Samsung</main>', "")).status, "BLOCKED");
});
test("account verification continues only with the proven success message and its CTA", async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<button>Continuar comprando</button>');
    assert.equal(await findEppVerifiedContinue(page), null);
    await page.setContent('<div role="dialog"><p>¡Tu cuenta ha sido verificada con éxito!</p><button>Continuar comprando</button></div>');
    assert.ok(await findEppVerifiedContinue(page));
  } finally { await context.close(); }
});
test("PE-specific login text uses the real sign-in component and never account creation", async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<div class="sign-in-component__content-footer"><button class="pill-btn--blue sign-in-component__content-footer-desc__cta">Crear cuenta</button><button class="pill-btn--blue">Ingresa para obtener beneficios exclusivos</button></div>');
    assert.equal(await eppAccountLoginAction(page).textContent(), "Ingresa para obtener beneficios exclusivos");
    await page.setContent('<div class="sign-in-component__content-footer"><button class="pill-btn--blue"></button></div>');
    assert.equal(await eppAccountLoginAction(page).count(), 0);
  } finally { await context.close(); }
});
