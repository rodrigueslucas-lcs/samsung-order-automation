const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");
const { createAuthState } = require("./authState");
const { withRegisteredSessionRecovery } = require("./registeredSessionRecovery");
const { getPeQstConfig, targetEnvironment } = require("../config/markets/pe");

const PE_ENVIRONMENT = targetEnvironment();
const PE_AUTH_SUFFIX = PE_ENVIRONMENT.toLowerCase();
const PE_AUTH_STATE_PATH = path.resolve(`playwright/.auth/pe-${PE_AUTH_SUFFIX}-user.json`);
const PE_AUTH_SESSION_STORAGE_PATH = path.resolve(`playwright/.auth/pe-${PE_AUTH_SUFFIX}-session-storage.json`);
const PE_VERIFIED_STATE_PATH = path.resolve(`playwright/.auth/pe-${PE_AUTH_SUFFIX}-verified.json`);

function hasPeAuthState() {
  return fs.existsSync(PE_AUTH_STATE_PATH) && fs.existsSync(PE_AUTH_SESSION_STORAGE_PATH);
}

function getPeAuthState(environment = process.env) {
  const config = getPeQstConfig(environment);
  const ci = ["1", "true"].includes(String(environment.CI || "").toLowerCase());
  const auth = createAuthState({
    authStatePath: PE_AUTH_STATE_PATH,
    sessionStoragePath: PE_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    setupUrl: config.setupUrl?.href || null,
    validationUrl: config.baseUrl.href,
    label: `${config.environment} PE`,
    refreshInstruction:
      `Open the dedicated PE ${config.environment} browser/profile, complete legitimate Samsung login, then export PE auth state. Do not commit auth artifacts.`,
    profileMenuTrigger: "hover",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: '[role="menu"].profile-menu',
    profileMenuReadySelector: '[role="menu"].profile-menu:not(.mat-menu-panel-animating)',
    navigationTimeoutMs: ci ? 120000 : 60000,
  });

  return withRegisteredSessionRecovery(auth, {
    market: "PE",
    environment: config.environment,
    loginScript: "scripts/auth-login-pe.cjs",
    autoRenewEnv: "PE_AUTH_AUTO_RENEW",
    env: {
      PE_QST_ENVIRONMENT: config.environment,
      PE_STOREFRONT_URL: config.baseUrl.href,
      ...(config.setupUrl ? { PE_SETUP_URL: config.setupUrl.href } : {}),
    },
  });
}

function markPeAuthStateVerified() {
  const auth = getPeAuthState();
  if (!auth.hasAuthState()) throw new Error(`Cannot mark PE ${PE_ENVIRONMENT} auth as verified because the auth state is missing.`);
  fs.mkdirSync(path.dirname(PE_VERIFIED_STATE_PATH), { recursive: true });
  writeJsonAtomically(PE_VERIFIED_STATE_PATH, {
    environment: PE_ENVIRONMENT,
    hostname: getPeQstConfig().baseUrl.hostname,
    verifiedAt: new Date().toISOString(),
    authStateMtimeMs: fs.statSync(auth.AUTH_STATE_PATH).mtimeMs,
    sessionStorageMtimeMs: fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs,
  });
}

function hasVerifiedPeAuthState() {
  const auth = getPeAuthState();
  if (!auth.hasAuthState() || !fs.existsSync(PE_VERIFIED_STATE_PATH)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(PE_VERIFIED_STATE_PATH, "utf8"));
    return marker.environment === PE_ENVIRONMENT &&
      marker.hostname === getPeQstConfig().baseUrl.hostname &&
      marker.authStateMtimeMs === fs.statSync(auth.AUTH_STATE_PATH).mtimeMs &&
      marker.sessionStorageMtimeMs === fs.statSync(auth.AUTH_SESSION_STORAGE_PATH).mtimeMs;
  } catch {
    return false;
  }
}

module.exports = {
  PE_ENVIRONMENT,
  PE_AUTH_SUFFIX,
  PE_AUTH_STATE_PATH,
  PE_AUTH_SESSION_STORAGE_PATH,
  PE_VERIFIED_STATE_PATH,
  getPeAuthState,
  hasPeAuthState,
  hasVerifiedPeAuthState,
  markPeAuthStateVerified,
};
