const fs = require("node:fs");
const path = require("node:path");
const { createAuthState } = require("./authState");
const { getPeQstConfig, targetEnvironment } = require("../config/markets/pe");

const PE_ENVIRONMENT = targetEnvironment();
const PE_AUTH_SUFFIX = PE_ENVIRONMENT.toLowerCase();
const PE_AUTH_STATE_PATH = path.resolve(`playwright/.auth/pe-${PE_AUTH_SUFFIX}-user.json`);
const PE_AUTH_SESSION_STORAGE_PATH = path.resolve(`playwright/.auth/pe-${PE_AUTH_SUFFIX}-session-storage.json`);

function hasPeAuthState() {
  return fs.existsSync(PE_AUTH_STATE_PATH) && fs.existsSync(PE_AUTH_SESSION_STORAGE_PATH);
}

function getPeAuthState(environment = process.env) {
  const config = getPeQstConfig(environment);
  return createAuthState({
    authStatePath: PE_AUTH_STATE_PATH,
    sessionStoragePath: PE_AUTH_SESSION_STORAGE_PATH,
    hostname: config.baseUrl.hostname,
    setupUrl: null,
    validationUrl: config.baseUrl.href,
    label: `${config.environment} PE`,
    refreshInstruction:
      `Open the dedicated PE ${config.environment} browser/profile, complete legitimate Samsung login, then export PE auth state. Do not commit auth artifacts.`,
    profileMenuTrigger: "click",
    logoutTextName: /Cerrar sesi[oó]n/i,
  });
}

module.exports = {
  PE_ENVIRONMENT,
  PE_AUTH_SUFFIX,
  PE_AUTH_STATE_PATH,
  PE_AUTH_SESSION_STORAGE_PATH,
  getPeAuthState,
  hasPeAuthState,
};
