const { createAuthState } = require("./authState");

module.exports = createAuthState({
  authStatePath: "playwright/.auth/mx-s1-user.json",
  sessionStoragePath: "playwright/.auth/mx-s1-session-storage.json",
  hostname: "stg.shop.samsung.com",
  setupUrl: "https://stg.shop.samsung.com/getcookie.html",
  validationUrl: "https://stg.shop.samsung.com/mx/",
  label: "S1 MX",
  refreshInstruction:
    "Run `npm run auth:open-profile:mx`, complete the login in normal Chrome, keep that Chrome open, then run `npm run auth:export:mx` from another terminal.",
  profileMenuTrigger: "hover",
  logoutLinkName: /^Cerrar Sesi[oó]n$/i,
});
