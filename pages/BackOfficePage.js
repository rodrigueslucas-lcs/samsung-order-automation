import BasePage from "./BasePage";

export const BACKOFFICE_AUTHORITIES = {
  admin: "Customer Support Administrator Role",
  agent: "Customer Support Agent Role",
};

const BACKOFFICE_URLS = {
  s2: "https://backoffice.cnmzsgcaar-samsunge12-s2-public.model-t.cc.commerce.ondemand.com/backoffice/",
  s3: "https://backoffice.cnmzsgcaar-samsunge12-s3-public.model-t.cc.commerce.ondemand.com/backoffice/",
};

export function getBackOfficeUrl() {
  if (process.env.BACKOFFICE_URL) return process.env.BACKOFFICE_URL;

  const environment = (process.env.BACKOFFICE_ENV || "s2").toLowerCase();
  const url = BACKOFFICE_URLS[environment];
  if (!url) {
    throw new Error(
      `Unsupported BACKOFFICE_ENV: ${environment}. Use s2, s3, or BACKOFFICE_URL.`
    );
  }
  return url;
}

export default class BackOfficePage extends BasePage {
  constructor(page) {
    super(page);

    this.url = getBackOfficeUrl();
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

    const maintenance = this.page.getByText(/service is down for maintenance/i);
    const forbidden = this.page.getByRole("heading", {
      name: /403: The server did not authorize the request/i,
    });
    if (await maintenance.isVisible().catch(() => false)) {
      throw new Error(
        `BackOffice is down for maintenance (HTTP 503 page): ${this.url}`
      );
    }
    if (await forbidden.isVisible().catch(() => false)) {
      throw new Error(
        `BackOffice denied access before login (HTTP 403): ${this.url}`
      );
    }

    await usernameInput.click();
    await usernameInput.pressSequentially(username, { delay: 35 });
    await usernameInput.press("Tab");
    await passwordInput.pressSequentially(password, { delay: 35 });
    await passwordInput.press("Tab");
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, { timeout: 10000 }).catch(() => {});
    await this.page.getByRole("button", { name: "Sign In", exact: true }).click();

    const proceedButton = this.page.getByRole("button", { name: "PROCEED", exact: true });
    const directPerspective = this.page
      .getByText("Administration Cockpit", { exact: true })
      .first();
    const loginOutcome = await Promise.race([
      proceedButton
        .waitFor({ state: "visible", timeout: 60000 })
        .then(() => "authority"),
      directPerspective
        .waitFor({ state: "visible", timeout: 60000 })
        .then(() => "direct-admin"),
      this.page
        .waitForURL(/login\.zul\?login_error=1/, { timeout: 60000 })
        .then(() => "rejected"),
    ]);
    if (loginOutcome === "rejected") {
      throw new Error(
        `BackOffice rejected the runtime credentials (login_error=1): ${this.url}`
      );
    }
    if (loginOutcome === "authority") {
      const authorityText = this.page.getByText(authorityLabel, { exact: true });
      await authorityText.waitFor({ state: "visible", timeout: 30000 });
      await authorityText.click();
      await proceedButton.click();
    } else if (authority !== "admin") {
      throw new Error(
        "BackOffice logged in directly to Administration Cockpit; an agent authority is unavailable."
      );
    }

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
