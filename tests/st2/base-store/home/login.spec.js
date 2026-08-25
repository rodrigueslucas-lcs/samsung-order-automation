const { test } = require("@playwright/test");
const HomePage = require("../../../../pages/HomePage").default;
const {
 requireAuthState,
 applyAuthSessionStorage,
 validateAuthenticatedSession,
 validateCurrentPageAuthenticated,
} = require("../../../../utils/authState");
test.describe("ST2 - Base Store - Registered Customer", () => {
 test.use({
   storageState: requireAuthState(),
 });
 test.beforeEach(async ({ context }) => {
   await applyAuthSessionStorage(context);
 });
 test("TC1 pre-auth - registered session is available from Home", async ({
   page,
 }) => {
   test.setTimeout(120000);
   await validateAuthenticatedSession(page);
 });
 test("TC2 pre-auth - registered session is available through the shop header", async ({
   page,
 }) => {
   test.setTimeout(120000);
   const homePage = new HomePage(page);
   await homePage.openHome();
   await homePage.header
     .getByRole("button", {
       name: "My Profile",
       exact: true,
     })
     .waitFor({
       state: "visible",
       timeout: 60000,
     });
   await validateCurrentPageAuthenticated(page);
 });
});
