const fs = require("node:fs");
const path = require("node:path");
const { createAuthState } = require("./authState");
const { getPeS1QstConfig } = require("../config/markets/pe");

const PE_AUTH_STATE_PATH = path.resolve("playwright/.auth/pe-s1-user.json");
const PE_AUTH_SESSION_STORAGE_PATH = path.resolve(
  "playwright/.auth/pe-s1-session-storage.json"
);

function hasPeAuthState() {
  return (
    fs.existsSync(PE_AUTH_STATE_PATH) &&
    fs.existsSync(PE_AUTH_SESSION_STORAGE_PATH)
  );
}

function getPeAuthState(environment = process.env) {
  const config = getPeS1QstConfig(environment);
  return createAuthState({
    authStatePath: PE_AUTH_STATE_PATH,
    sessionStoragePath: PE_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    // Bootstrap/setup must happen before exporting the authenticated state.
    // Do not reopen setup after restoring auth unless live PE evidence proves it is safe.
    setupUrl: null,
    validationUrl: config.baseUrl.href,
    label: "S1 PE",
    refreshInstruction:
      "Open the dedicated PE S1 browser/profile, complete legitimate Samsung login, then export PE auth state. Do not commit auth artifacts.",
    profileMenuTrigger: "click",
    logoutTextName: /Cerrar sesi[oó]n/i,
  });
}

module.exports = {
  PE_AUTH_STATE_PATH,
  PE_AUTH_SESSION_STORAGE_PATH,
  getPeAuthState,
  hasPeAuthState,
};
