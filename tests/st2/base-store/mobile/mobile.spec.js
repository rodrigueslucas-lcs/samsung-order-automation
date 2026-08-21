import { test } from "@playwright/test";
import HomePage from "../../../../pages/HomePage";
test.describe("ST2 - Base Store - Mobile Smoke", () => {
 test.use({
   viewport: {
     width: 390,
     height: 844,
   },
 });
 test("Mobile - Header and Footer responsive smoke", async ({ page }) => {
   test.setTimeout(180000);
   const homePage = new HomePage(page);
   await homePage.openHome();
   // =========================
   // Mobile Header
   // =========================
   const menuButton = page.getByRole("button", {
     name: "Menú",
     exact: true,
   });
   const searchButton = page.getByRole("button", {
     name: "Search",
     exact: true,
   });
   const homeLink = page.getByRole("link", {
     name: "Homepage",
     exact: true,
   });
   await menuButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await searchButton.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await homeLink.waitFor({
     state: "visible",
     timeout: 30000,
   });
   // =========================
   // Mobile Footer
   // =========================
   const footer = page.getByRole("contentinfo");
   await footer.scrollIntoViewIfNeeded();
   await footer.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const tiendaMenu = footer.getByRole("button", {
     name: "Open Tienda menu",
     exact: true,
   });
   const productosMenu = footer.getByRole("button", {
     name: "Open Productos menu",
     exact: true,
   });
   const soporteMenu = footer.getByRole("button", {
     name: "Open Soporte menu",
     exact: true,
   });
   const cuentaMenu = footer.getByRole("button", {
     name: "Open Cuenta menu",
     exact: true,
   });
   await tiendaMenu.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await productosMenu.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await soporteMenu.waitFor({
     state: "visible",
     timeout: 30000,
   });
   await cuentaMenu.waitFor({
     state: "visible",
     timeout: 30000,
   });
   // Valida interação responsiva sem sair do ST2.
   await tiendaMenu.click();
   await page.screenshot({
     path: "evidence/screenshots/mobile-header-footer-smoke.png",
     fullPage: false,
   });
 });
});
