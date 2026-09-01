export default class BasePage {
  constructor(page) {
    this.page = page;
  }

  async screenshot(name) {
    const path = `evidence/screenshots/${name}.png`;

    try {
      await this.page.screenshot({ path, fullPage: true, timeout: 30000, animations: "disabled" });
    } catch (error) {
      if (!/screenshot.*timeout|timeout.*screenshot/i.test(error.message)) {
        throw error;
      }

      await this.page.screenshot({ path, fullPage: false, timeout: 30000, animations: "disabled" });
    }
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
  }
}
