const { createAuthState } = require("./authState");
const { resolveMxEnvironment } = require("./mxConfig");

const target = resolveMxEnvironment();
const suffix = target.name.toLowerCase();

module.exports = createAuthState({
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