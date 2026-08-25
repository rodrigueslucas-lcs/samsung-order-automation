import BasePage from "./BasePage";

export const BACKOFFICE_AUTHORITIES = {
  admin: "Customer Support Administrator Role",
  agent: "Customer Support Agent Role",
};

export default class BackOfficePage extends BasePage {
  constructor(page) {
    super(page);

    this.url =
      process.env.BACKOFFICE_URL ||
      "https://backoffice.cnmzsgcaar-samsunge12-s2-public.model-t.cc.commerce.ondemand.com/backoffice/";
  }

  async login({ username, password, authority }) {
    if (!username || !password) {
      throw new Error("BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime.");
    }
    const authorityLabel = BACKOFFICE_AUTHORITIES[authority];
    if (!authorityLabel) throw new Error(`Unsupported BackOffice authority: ${authority}`);

    await this.page.goto(this.url, { waitUntil: "domcontentloaded" });
    const usernameInput = this.page.getByPlaceholder("Enter user name", { exact: true });
    const passwordInput = this.page.getByPlaceholder("Enter password", { exact: true });

    await usernameInput.click();
    await usernameInput.pressSequentially(username, { delay: 35 });
    await usernameInput.press("Tab");
    await passwordInput.pressSequentially(password, { delay: 35 });
    await passwordInput.press("Tab");
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, { timeout: 10000 }).catch(() => {});
    await this.page.getByRole("button", { name: "Sign In", exact: true }).click();

    const proceedButton = this.page.getByRole("button", { name: "PROCEED", exact: true });
    await proceedButton.waitFor({ state: "visible", timeout: 60000 });
    const authorityText = this.page.getByText(authorityLabel, { exact: true });
    await authorityText.waitFor({ state: "visible", timeout: 30000 });
    await authorityText.click();
    await proceedButton.click();

    await this.expectPerspective(authority);
  }

  async expectPerspective(authority) {
    const perspectiveName =
      authority === "admin" ? "Administration Cockpit" : "Customer Support";
    await this.page
      .getByText(perspectiveName, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
  }

  async openTreeRow(name) {
    const row = this.page.getByRole("row", { name, exact: true });
    await row.waitFor({ state: "visible", timeout: 30000 });
    await row.click();
  }
}
