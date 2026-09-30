const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");
const { createAuthState } = require("./authState");
const { getCoQstConfig, targetEnvironment } = require("../config/markets/co");

const CO_ENVIRONMENT = targetEnvironment();
const CO_AUTH_SUFFIX = CO_ENVIRONMENT.toLowerCase();
const CO_AUTH_STATE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}-user.json`);
const CO_AUTH_SESSION_STORAGE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}-session-storage.json`);
const CO_VERIFIED_STATE_PATH = path.resolve(`playwright/.auth/co-${CO_AUTH_SUFFIX}-verified.json`);

function hasCoAuthState() {
  return fs.existsSync(CO_AUTH_STATE_PATH) && fs.existsSync(CO_AUTH_SESSION_STORAGE_PATH);
}

function getCoAuthState(environment = process.env) {
  const config = getCoQstConfig(environment);
  return createAuthState({
    authStatePath: CO_AUTH_STATE_PATH,
    sessionStoragePath: CO_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    setupUrl: config.setupUrl?.href || null,
    validationUrl: config.baseUrl.href,
    label: `${config.environment} CO`,
    refreshInstruction:
      `Ocon the dedicated CO ${config.environment} browser/profile, complete legitimate Samsung login, then export CO auth state. Do not commit auth artifacts.`,
    profileMenuTrigger: "hover",
    logoutTextName: /Cerrar Sesi[oó]n/i,
    authenticatedMenuSelector: '[role="menu"].profile-menu',
    profileMenuReadySelector: '[role="menu"].profile-menu:not(.mat-menu-panel-animating)',
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
  CO_AUTH_STATE_PATH,
  CO_AUTH_SESSION_STORAGE_PATH,
  CO_VERIFIED_STATE_PATH,
  getCoAuthState,
  hasCoAuthState,
  hasVerifiedCoAuthState,
  markCoAuthStateVerified,
};
