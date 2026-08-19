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

    if (heroCount > 0 || topSellerCount > 0) {
      throw new Error(
        `Unexpected ST2 Home state. Hero count: ${heroCount}, Top Seller count: ${topSellerCount}`
      );
    }

    await this.screenshot("homepage-header-footer");
  }
}
