const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");
const { createAuthState } = require("./authState");
const { withRegisteredSessionRecovery } = require("./registeredSessionRecovery");
const { getClQstConfig, targetEnvironment } = require("../config/markets/cl");

const CL_ENVIRONMENT = targetEnvironment();
const CL_AUTH_SUFFIX = CL_ENVIRONMENT.toLowerCase();
const CL_AUTH_SLOT = String(process.env.CL_AUTH_SLOT || "primary").toLowerCase();
if (!["primary", "second"].includes(CL_AUTH_SLOT)) throw new Error(`Unsupported CL auth slot: ${CL_AUTH_SLOT}.`);
const slotInfix = CL_AUTH_SLOT === "second" ? "-second" : "";
const CL_AUTH_STATE_PATH = path.resolve(`playwright/.auth/cl-${CL_AUTH_SUFFIX}${slotInfix}-user.json`);
const CL_AUTH_SESSION_STORAGE_PATH = path.resolve(`playwright/.auth/cl-${CL_AUTH_SUFFIX}${slotInfix}-session-storage.json`);
const CL_VERIFIED_STATE_PATH = path.resolve(`playwright/.auth/cl-${CL_AUTH_SUFFIX}${slotInfix}-verified.json`);

function hasClAuthState() {
  return fs.existsSync(CL_AUTH_STATE_PATH) && fs.existsSync(CL_AUTH_SESSION_STORAGE_PATH);
}

function getClAuthState(environment = process.env) {
  const config = getClQstConfig(environment);
  const auth = createAuthState({
    authStatePath: CL_AUTH_STATE_PATH,
    sessionStoragePath: CL_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    setupUrl: config.setupUrl?.href || null,
    validationUrl: config.baseUrl.href,
    label: `${config.environment} CL${CL_AUTH_SLOT === "second" ? " second account" : ""}`,
    refreshInstruction:
      `Open the dedicated CL ${config.environment} browser/profile, complete legitimate Samsung login, then export CL auth state. Do not commit auth artifacts.`,
    profileMenuTrigger: "hover",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: '[role="menu"].profile-menu',
    profileMenuReadySelector: '[role="menu"].profile-menu:not(.mat-menu-panel-animating)',
  });

  return withRegisteredSessionRecovery(auth, {
    market: "CL",
    environment: config.environment,
    loginScript: "scripts/auth-login-cl.cjs",
    autoRenewEnv: "CL_AUTH_AUTO_RENEW",
    enabled: fs.existsSync(path.resolve("scripts/auth-login-cl.cjs")),
    env: {
      CL_QST_ENVIRONMENT: config.environment,
      CL_STOREFRONT_URL: config.baseUrl.href,
      CL_AUTH_SLOT,
    },
  });
}

function markClAuthStateVerified() {
  const auth = getClAuthState();
  if (!auth.hasAuthState()) throw new Error(`Cannot mark CL ${CL_ENVIRONMENT} auth as verified because the auth state is missing.`);
  fs.mkdirSync(path.dirname(CL_VERIFIED_STATE_PATH), { recursive: true });
  writeJsonAtomically(CL_VERIFIED_STATE_PATH, {
    environment: CL_ENVIRONMENT,
    hostname: getClQstConfig().baseUrl.hostname,
    slot: CL_AUTH_SLOT,
    verifiedAt: new Date().toISOString(),
    authStateMtimeMs: fs.statSync(auth.AUTH_STATE_PATH).mtimeMs,
    sessionStorageMtimeMs: fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs,
  });
}

function hasVerifiedClAuthState() {
  const auth = getClAuthState();
  if (!auth.hasAuthState() || !fs.existsSync(CL_VERIFIED_STATE_PATH)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(CL_VERIFIED_STATE_PATH, "utf8"));
    return marker.environment === CL_ENVIRONMENT &&
      marker.hostname === getClQstConfig().baseUrl.hostname &&
      (marker.slot || "primary") === CL_AUTH_SLOT &&
      marker.authStateMtimeMs === fs.statSync(auth.AUTH_STATE_PATH).mtimeMs &&
      marker.sessionStorageMtimeMs === fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs;
  } catch {
    return false;
  }
}

module.exports = {
  CL_ENVIRONMENT,
  CL_AUTH_SUFFIX,
  CL_AUTH_SLOT,
  CL_AUTH_STATE_PATH,
  CL_AUTH_SESSION_STORAGE_PATH,
  CL_VERIFIED_STATE_PATH,
  getClAuthState,
  hasClAuthState,
  hasVerifiedClAuthState,
  markClAuthStateVerified,
};
