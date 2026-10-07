const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");
const { createAuthState } = require("./authState");
const { withRegisteredSessionRecovery } = require("./registeredSessionRecovery");
const { getCoQstConfig, targetEnvironment } = require("../config/markets/co");

const CO_ENVIRONMENT = targetEnvironment();
const CO_AUTH_SUFFIX = CO_ENVIRONMENT.toLowerCase();
const CO_AUTH_SLOT = String(process.env.CO_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(CO_AUTH_SLOT)) throw new Error(`Unsupported CO auth slot: ${CO_AUTH_SLOT}.`);
const slotInfix = CO_AUTH_SLOT === "second" ? "-second" : "";
const CO_AUTH_STATE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}${slotInfix}-user.json`);
const CO_AUTH_SESSION_STORAGE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}${slotInfix}-session-storage.json`);
const CO_VERIFIED_STATE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}${slotInfix}-verified.json`);

function hasCoAuthState() {
  return fs.existsSync(CO_AUTH_STATE_PATH) && fs.existsSync(CO_AUTH_SESSION_STORAGE_PATH);
}

function getCoAuthState(environment = process.env) {
  const config = getCoQstConfig(environment);
  const preQa2 = config.environment === "S2" && config.baseUrl.hostname === "p6-pre-qa2.samsung.com";
  const auth = createAuthState({
    authStatePath: CO_AUTH_STATE_PATH,
    sessionStoragePath: CO_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    setupUrl: preQa2 ? null : config.setupUrl?.href || null,
    validationUrl: config.baseUrl.href,
    label: `${config.environment} CO${CO_AUTH_SLOT === "second" ? " second account" : ""}`,
    refreshInstruction:
      `Open the dedicated CO ${config.environment} browser/profile, complete legitimate Samsung login, then export CO auth state. Do not commit auth artifacts.`,
    profileMenuTrigger: preQa2 ? "click" : "hover",
    profileButtonSelector: preQa2
      ? "button.nv00-gnb-v4__utility-user:visible"
      : 'button[data-an-la="L0_13_login"]:visible, button.nv00-gnb-v4__utility-user:visible',
    storefrontDismissTextName: preQa2 ? null : "¡Listo!",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: preQa2 ? '[role="menu"][aria-label="account"]' : '[role="menu"].profile-menu',
    profileMenuReadySelector: preQa2 ? '[role="menu"][aria-label="account"][aria-hidden="false"]' : '[role="menu"].profile-menu',
  });

  return withRegisteredSessionRecovery(auth, {
    market: "CO",
    environment: config.environment,
    loginScript: "scripts/auth-login-co.cjs",
    autoRenewEnv: "CO_AUTH_AUTO_RENEW",
    enabled: !preQa2,
    env: {
      CO_QST_ENVIRONMENT: config.environment,
      CO_STOREFRONT_URL: config.baseUrl.href,
      CO_AUTH_SLOT,
    },
  });
}

function markCoAuthStateVerified() {
  const auth = getCoAuthState();
  if (!auth.hasAuthState()) throw new Error(`Cannot mark CO ${CO_ENVIRONMENT} auth as verified because the auth state is missing.`);
  fs.mkdirSync(path.dirname(CO_VERIFIED_STATE_PATH), { recursive: true });
  writeJsonAtomically(CO_VERIFIED_STATE_PATH, {
    environment: CO_ENVIRONMENT,
    hostname: getCoQstConfig().baseUrl.hostname,
    verifiedAt: new Date().toISOString(),
    authStateMtimeMs: fs.statSync(auth.AUTH_STATE_PATH).mtimeMs,
    sessionStorageMtimeMs: fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs,
  });
}

function hasVerifiedCoAuthState() {
  const auth = getCoAuthState();
  if (!auth.hasAuthState() || !fs.existsSync(CO_VERIFIED_STATE_PATH)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(CO_VERIFIED_STATE_PATH, "utf8"));
    return marker.environment === CO_ENVIRONMENT &&
      marker.hostname === getCoQstConfig().baseUrl.hostname &&
      marker.authStateMtimeMs === fs.statSync(auth.AUTH_STATE_PATH).mtimeMs &&
      marker.sessionStorageMtimeMs === fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs;
  } catch {
    return false;
  }
}

module.exports = {
  CO_ENVIRONMENT,
  CO_AUTH_SUFFIX,
  CO_AUTH_SLOT,
  CO_AUTH_STATE_PATH,
  CO_AUTH_SESSION_STORAGE_PATH,
  CO_VERIFIED_STATE_PATH,
  getCoAuthState,
  hasCoAuthState,
  hasVerifiedCoAuthState,
  markCoAuthStateVerified,
};
