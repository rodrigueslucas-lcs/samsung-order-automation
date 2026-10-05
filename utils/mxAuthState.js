const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomically } = require("./atomicJson");
const { createAuthState } = require("./authState");
const { withRegisteredSessionRecovery } = require("./registeredSessionRecovery");
const { resolveMxEnvironment } = require("./mxConfig");

const target = resolveMxEnvironment();
const suffix = target.name.toLowerCase();
const requestedSlot = String(process.env.MX_AUTH_SLOT || "primary").trim().toLowerCase();
if (!["primary", "second"].includes(requestedSlot)) {
  throw new Error(`Unsupported MX auth slot: ${requestedSlot}. Use primary or second.`);
}
const slotInfix = requestedSlot === "second" ? "-second" : "";
const slotLabel = requestedSlot === "second" ? " second account" : "";
const verifiedStatePath = path.resolve(`playwright/.auth/mx-${suffix}${slotInfix}-verified.json`);

const baseAuthState = createAuthState({
  authStatePath: `playwright/.auth/mx-${suffix}${slotInfix}-user.json`,
  sessionStoragePath: `playwright/.auth/mx-${suffix}${slotInfix}-session-storage.json`,
  hostname: target.hostname,
  setupUrl: `https://${target.hostname}/getcookie.html`,
  validationUrl: `https://${target.hostname}/mx/`,
  label: `${target.name} MX${slotLabel}`,
  refreshInstruction:
    `Run the MX auth bootstrap with MX_QST_ENVIRONMENT=${target.name}${requestedSlot === "second" ? " MX_AUTH_SLOT=second" : ""}; complete Samsung Account verification manually when required.`,
  profileMenuTrigger: "hover",
  logoutLinkName: null,
  logoutTextName: /Cerrar Sesi[oó]n/i,
  authenticatedMenuSelector: '[role="menu"].profile-menu',
});

const authState = withRegisteredSessionRecovery(baseAuthState, {
  market: `MX${slotLabel}`,
  environment: target.name,
  loginScript: "scripts/auth-login-mx.cjs",
  autoRenewEnv: "MX_AUTH_AUTO_RENEW",
  env: {
    MX_QST_ENVIRONMENT: target.name,
    MX_AUTH_SLOT: requestedSlot,
  },
});

function writeJsonSecurely(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  writeJsonAtomically(destination, value);
}

function markAuthStateVerified() {
  if (!authState.hasAuthState()) {
    throw new Error(`Cannot mark MX ${target.name}${slotLabel} auth as verified because the auth state is missing.`);
  }

  writeJsonSecurely(verifiedStatePath, {
    environment: target.name,
    hostname: target.hostname,
    slot: requestedSlot,
    verifiedAt: new Date().toISOString(),
    authStateMtimeMs: fs.statSync(authState.AUTH_STATE_PATH).mtimeMs,
    sessionStorageMtimeMs: fs.statSync(authState.AUTH_SESSION_STORAGE_PATH).mtimeMs,
  });
}

function hasVerifiedAuthState() {
  if (!authState.hasAuthState() || !fs.existsSync(verifiedStatePath)) return false;

  try {
    const marker = JSON.parse(fs.readFileSync(verifiedStatePath, "utf8"));
    return marker.environment === target.name &&
      marker.hostname === target.hostname &&
      (marker.slot || "primary") === requestedSlot &&
      marker.authStateMtimeMs === fs.statSync(authState.AUTH_STATE_PATH).mtimeMs &&
      marker.sessionStorageMtimeMs === fs.statSync(authState.AUTH_SESSION_STORAGE_PATH).mtimeMs;
  } catch {
    return false;
  }
}

module.exports = {
  ...authState,
  AUTH_SLOT: requestedSlot,
  VERIFIED_STATE_PATH: verifiedStatePath,
  hasVerifiedAuthState,
  markAuthStateVerified,
};
