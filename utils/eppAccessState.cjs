// Pure classification: visible shell/footer content never proves EPP access.
function classifyEppAccess({ url, rootUrl, body = "", corporateEmailVisible = false, codeVisible = false, codeRejected = false, commerceVisible = false, authenticatedHomepageVisible = false }) {
  const current = new URL(url);
  const root = new URL(rootUrl);
  if (current.origin !== root.origin || !current.pathname.startsWith(root.pathname)) {
    return { status: "BLOCKED", reason: "OUTSIDE_EPP_STORE" };
  }
  if (codeVisible && codeRejected) return { status: 'BLOCKED', reason: 'VERIFICATION_CODE_REJECTED' };
  if (corporateEmailVisible && /registration|auth\/multistore/i.test(current.pathname)) {
    return { status: "HUMAN_REQUIRED", reason: "CORPORATE_ACTIVATION_REQUIRED" };
  }
  if (/auth\/multistore|\/registration\/?$/i.test(current.pathname)) {
    if (codeVisible) return { status: "CODE_REQUIRED", reason: "VERIFICATION_CODE_GATE" };
    if (/samsung\s*account|cuenta\s+samsung/i.test(body)) {
      return { status: "HUMAN_REQUIRED", reason: "EPP_IDENTITY_REQUIRED" };
    }
    return { status: "BLOCKED", reason: "ACCESS_GATE_NOT_READY" };
  }
  if (codeVisible || corporateEmailVisible) return { status: "BLOCKED", reason: "ACCESS_GATE_VISIBLE" };
  if (authenticatedHomepageVisible && current.pathname === root.pathname) return { status: "READY", reason: "AUTHENTICATED_EPP_HOMEPAGE" };
  return commerceVisible
    ? { status: "READY", reason: "MULTISTORE_CONTENT_PROVEN" }
    : { status: "BLOCKED", reason: "COMMERCE_CONTENT_NOT_RENDERED" };
}

async function observeEppAccess(page, config) {
  let dom;
  try {
    dom = await page.evaluate(({allowProgrammeWelcome}) => {
      const visible = e => !!(e.getBoundingClientRect().width && e.getBoundingClientRect().height);
      return { body: document.body?.innerText || "",
        corporateEmailVisible: [...document.querySelectorAll('input[type="email"]')].some(visible),
        codeVisible: [...document.querySelectorAll("input")].some(e => visible(e) && /verification|access code|c[oó]digo|clave de acceso/i.test(`${e.placeholder} ${e.getAttribute("aria-label") || ""} ${[...(e.labels || [])].map(label => label.textContent).join(" ")}`)),
        codeRejected: [...document.querySelectorAll('mat-error,.mat-mdc-form-field-error,[role="alert"]')].some(e => visible(e) && /c[oó]digo.*(?:v[aá]lido|incorrecto)|invalid.*verification code|verification code.*invalid/i.test(e.textContent)),
        commerceVisible: [...document.querySelectorAll('.product-card,.product-detail,.product-details,.product-detail-container,.pdp,cx-page-layout.ProductDetailsPageTemplate,[data-component="product-card"]')].some(visible),
        authenticatedHomepageVisible: (!!document.querySelector('cx-page-layout.LandingPage2Template')||allowProgrammeWelcome) && [...document.querySelectorAll('a,button,span,div,p,h1,h2,h3')].some(e => visible(e) && /^Cerrar sesi[oó]n$|^Sign out$|^Salir$|^Welcome,\s+\S+|^Bienvenid[oa],?\s+\S+/i.test(e.textContent.trim())) };
    },{allowProgrammeWelcome:!!config.programNamespace});
  } catch (error) {
    // A read racing a real navigation is pending, not an invalid identity.
    // The caller's deadline bounds further observation; no action is replayed.
    if (/Execution context was destroyed|Cannot find context with specified id/.test(error.message) && !page.isClosed()) {
      return { status: "BLOCKED", reason: "NAVIGATION_IN_PROGRESS" };
    }
    throw error;
  }
  return classifyEppAccess({ url: page.url(), rootUrl: config.rootUrl.href, ...dom });
}

async function findEppVerifiedContinue(page) {
  const success = page.getByText(/Tu cuenta ha sido verificada con éxito|¡Éxito!\s*Tu cuenta ha sido verificada|Your account has been successfully verified/i).filter({ visible: true }).first();
  if (!(await success.isVisible().catch(() => false))) return null;
  const button = page.getByRole("button", { name: /^Continuar comprando$|^Seguir comprando$|^Continue shopping$/i })
    .or(page.getByRole("link", { name: /^Continuar comprando$|^Seguir comprando$|^Continue shopping$/i })).filter({ visible: true }).first();
  return await button.isVisible().catch(() => false) ? button : null;
}

async function proveEppAccess(page, config) {
  const state = await observeEppAccess(page, config);
  if (state.reason !== "COMMERCE_CONTENT_NOT_RENDERED" || new URL(page.url()).pathname !== config.rootUrl.pathname || !(await page.locator("cx-page-layout.LandingPage2Template").count())) return state;
  const { authProfileControl, openAuthProfile } = require("./authStorefrontReady.cjs");
  if (!(await authProfileControl(page).isVisible())) return state;
  // Empty EPP CMS product slots do not mean a failed login. Prove the exact
  // landing route/template AND its authenticated logout action independently.
  const profile = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
  if (profile.state !== "authenticated") return { status: "HUMAN_REQUIRED", reason: "EPP_IDENTITY_REQUIRED" };
  return observeEppAccess(page, config);
}

function eppAccountLoginAction(page) {
  // Same observed sign-in component, different configured market labels.
  // Exclude the separate account-creation CTA and wait for real text/hydration.
  return page.locator(".sign-in-component__content-footer > button.pill-btn--blue:not(.sign-in-component__content-footer-desc__cta)")
    .or(page.getByRole("button", { name: /^Ingresar$|^Iniciar sesi[oó]n$|^Sign in$|^Entrar$/i }))
    .filter({ hasText: /\S/, visible: true }).first();
}

function configuredEppAuthEntry(config,{url,loginVisible,profileVisible,codeVisible,emailVisible,pendingVerification}){
  if(!config.authEntryUrl||loginVisible||profileVisible||codeVisible||emailVisible||pendingVerification)return null;
  const current=new URL(url),root=new URL(config.rootUrl),target=new URL(config.authEntryUrl);
  if(current.origin!==root.origin||current.pathname!==root.pathname)return null;
  if(target.origin!==root.origin||target.pathname!==root.pathname+'auth/multistore'||target.search||target.hash||target.username||target.password)throw new Error('EPP auth entry must remain on its configured staging programme.');
  return target;
}

module.exports = { classifyEppAccess, observeEppAccess, proveEppAccess, findEppVerifiedContinue, eppAccountLoginAction, configuredEppAuthEntry };
