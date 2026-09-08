const { createAuthState } = require("./authState");

module.exports = createAuthState({
  authStatePath: "playwright/.auth/mx-s1-user.json",
  sessionStoragePath: "playwright/.auth/mx-s1-session-storage.json",
  hostname: "stg.shop.samsung.com",
  // The dedicated profile performs getcookie setup before login. Reopening it
  // after restoring storage replaces the authenticated MX storefront session.
  setupUrl: null,
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
