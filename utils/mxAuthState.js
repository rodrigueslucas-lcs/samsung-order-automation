const fs = require("node:fs");
const path = require("node:path");
const { createAuthState } = require("./authState");
const { resolveMxEnvironment } = require("./mxConfig");

const target = resolveMxEnvironment();
const suffix = target.name.toLowerCase();
const verifiedStatePath = path.resolve(`playwright/.auth/mx-${suffix}-verified.json`);

const authState = createAuthState({
  authStatePath: `playwright/.auth/mx-${suffix}-user.json`,
  sessionStoragePath: `playwright/.auth/mx-${suffix}-session-storage.json`,
  hostname: target.hostname,
  setupUrl: `https://${target.hostname}/getcookie.html`,
  validationUrl: `https://${target.hostname}/mx/`,
  label: `${target.name} MX`,
  refreshInstruction:
    `Run the MX auth bootstrap with MX_QST_ENVIRONMENT=${target.name}; complete Samsung Account verification manually when required.`,
  profileMenuTrigger: "hover",
  logoutLinkName: null,
  logoutTextName: /Cerrar Sesi[oó]n/i,
  authenticatedMenuSelector: '[role="menu"].profile-menu',
});

function writeJsonSecurely(destination, value) {
  const temporary = `${destination}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, destination);
}

function markAuthStateVerified() {
  if (!authState.hasAuthState()) {
    throw new Error(`Cannot mark MX ${target.name} auth as verified because the auth state is missing.`);
  }

  writeJsonSecurely(verifiedStatePath, {
    environment: target.name,
    hostname: target.hostname,
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
      marker.authStateMtimeMs === fs.statSync(authState.AUTH_STATE_PATH).mtimeMs &&
      marker.sessionStorageMtimeMs === fs.statSync(authState.AUTH_SESSION_STORAGE_PATH).mtimeMs;
  } catch {
    return false;
  }
}

module.exports = {
  ...authState,
  VERIFIED_STATE_PATH: verifiedStatePath,
  hasVerifiedAuthState,
  markAuthStateVerified,
};
