import BasePage from "./BasePage";

export default class HomePage extends BasePage {
  constructor(page) {
    super(page);

    this.setupUrl = "https://stg2.shop.samsung.com/getcookie.html";
    this.homeUrl = "https://stg2.shop.samsung.com/pe/";

    this.header = page.getByRole("banner");
    this.footer = page.getByRole("contentinfo");
    this.main = page.getByRole("main");
  }

  async openHome() {
    await this.page.goto(this.setupUrl);

    await this.page
      .getByText(/You can access pages now/i)
      .waitFor({
        state: "visible",
        timeout: 60000,
      });

    await this.page.goto(this.homeUrl);

    await this.header.waitFor({
      state: "visible",
      timeout: 60000,
    });

    await this.footer.waitFor({
      state: "visible",
      timeout: 60000,
    });

    const maintenanceMessage = this.page.getByText(
      /SystemParking|Page Under Maintenance/i
    );

    if (await maintenanceMessage.count()) {
      throw new Error("ST2 Home opened in maintenance mode.");
    }
  }

  async openGuestOrders() {
   await this.footer.scrollIntoViewIfNeeded();
   const ordersEntry = this.footer
     .getByText("Pedidos", { exact: true })
     .filter({ visible: true });
   await ordersEntry.waitFor({
     state: "visible",
     timeout: 30000,
   });
   const popupPromise = this.page.context().waitForEvent("page", {
     timeout: 30000,
   });
   await ordersEntry.click();
   const ordersPage = await popupPromise;
   await ordersPage.waitForURL(/https:\/\/[^/]*samsung\.com\/pe\//i, {
     timeout: 60000,
   });
   await ordersPage.waitForLoadState("domcontentloaded", {
     timeout: 60000,
   });
   const url = new URL(ordersPage.url());
   if (!/samsung\.com$/i.test(url.hostname) &&
       !/\.samsung\.com$/i.test(url.hostname)) {
     throw new Error(
       `Unexpected orders/tracking destination: ${ordersPage.url()}`
     );
   }
   if (!/\/pe\//i.test(url.pathname)) {
     throw new Error(
       `Orders/tracking destination is not Peru: ${ordersPage.url()}`
     );
   }
   return ordersPage;
 }
  async validateHomepageAttributes() {
    await this.header
      .getByRole("link", { name: "Homepage" })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    await this.footer.scrollIntoViewIfNeeded();

    await this.footer
      .getByRole("heading", { name: "Tienda" })
      .waitFor({
        state: "visible",
        timeout: 30000,
      });

    const hero = this.main.locator(
      '[class*="hero" i], [class*="kv" i]'
    );

    const topSeller = this.main.getByText(
      /Top seller|Más vendidos|Más vendido|Lo más vendido/i
    );

    const heroCount = await hero.count();
    const topSellerCount = await topSeller.count();

    await this.screenshot("homepage-header-footer");

    return {
      headerVisible: true,
      footerVisible: true,
      heroVisible: heroCount > 0,
      topSellerVisible: topSellerCount > 0,
    };
  }
}
