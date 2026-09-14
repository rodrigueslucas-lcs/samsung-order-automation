const { createAuthState } = require("./authState");

module.exports = createAuthState({
  authStatePath: "playwright/.auth/mx-s1-user.json",
  sessionStoragePath: "playwright/.auth/mx-s1-session-storage.json",
  hostname: "stg.shop.samsung.com",
  // Every fresh Playwright browser context needs the staging access cookie
  // restored before opening the authenticated storefront. The exported
  // storage/session state alone is not sufficient and otherwise redirects to
  // /onlinestore/uk/SystemParking.html.
  setupUrl: "https://stg.shop.samsung.com/getcookie.html",
  validationUrl: "https://stg.shop.samsung.com/mx/",
  label: "S1 MX",
  refreshInstruction:
    "Run `npm run auth:open-profile:mx`, then use `npm run auth:login:mx` with MX_SAMSUNG_EMAIL and MX_SAMSUNG_PASSWORD, or complete login manually and run `npm run auth:export:mx`.",
  profileMenuTrigger: "hover",
  // MX renders the authenticated action as menu text without a stable link role.
  logoutLinkName: null,
  logoutTextName: /Cerrar Sesi[oó]n/i,
  authenticatedMenuSelector: '[role="menu"].profile-menu',
});
