export default class BasePage {
  constructor(page) {
    this.page = page;
  }

  async screenshot(name) {
    await this.page.screenshot({
      path: `evidence/screenshots/${name}.png`,
      fullPage: true
    });
  }

 async waitForPageLoad() {
  await this.page.waitForLoadState('domcontentloaded');
}
}