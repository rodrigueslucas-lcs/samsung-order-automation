import BasePage from "./BasePage";

export const BACKOFFICE_AUTHORITIES = {
  admin: "Customer Support Administrator Role",
  agent: "Customer Support Agent Role",
};

const BACKOFFICE_URLS = {
  s1: "https://backoffice.cnmzsgcaar-samsunge12-s1-public.model-t.cc.commerce.ondemand.com/backoffice/",
  s2: "https://backoffice.cnmzsgcaar-samsunge12-s2-public.model-t.cc.commerce.ondemand.com/backoffice/",
  s3: "https://backoffice.cnmzsgcaar-samsunge12-s3-public.model-t.cc.commerce.ondemand.com/backoffice/",
};

export function getBackOfficeUrl(explicitUrl) {
  const mxEnvironment = process.env.MX_QST_ENVIRONMENT?.toLowerCase();
  const configuredEnvironment = process.env.BACKOFFICE_ENV?.toLowerCase();
  if (mxEnvironment && configuredEnvironment && mxEnvironment !== configuredEnvironment) {
    throw new Error(
      `BackOffice environment mismatch: MX_QST_ENVIRONMENT=${mxEnvironment.toUpperCase()} but BACKOFFICE_ENV=${configuredEnvironment}.`
    );
  }
  const environment = configuredEnvironment || mxEnvironment || "s1";
  const url = BACKOFFICE_URLS[environment];
  if (!url) {
    throw new Error(
      `Unsupported BACKOFFICE_ENV: ${environment}. Use s1, s2, s3, or BACKOFFICE_URL.`
    );
  }
  const resolvedUrl = explicitUrl || process.env.BACKOFFICE_URL || url;
  const hostname = new URL(resolvedUrl).hostname;
  if (!hostname.includes(`-${environment}-public.`)) {
    throw new Error(
      `BackOffice URL/environment mismatch: ${environment} resolved host ${hostname}.`
    );
  }
  return resolvedUrl;
}

export default class BackOfficePage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.url = getBackOfficeUrl(options.url);
  }

  async openLoginSurface() {
    const usernameInput = this.page.getByPlaceholder("Enter user name", { exact: true });
    const passwordInput = this.page.getByPlaceholder("Enter password", { exact: true });
    const directPerspective = this.page
      .getByText("Administration Cockpit", { exact: true })
      .first();
    const maintenance = this.page.getByText(/service is down for maintenance/i);
    const forbidden = this.page.getByRole("heading", {
      name: /403: The server did not authorize the request/i,
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt === 1) {
        await this.page.goto(this.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      } else {
        console.log(`[backoffice] login shell still not ready; controlled reload ${attempt - 1}/2`);
        await this.page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      }

      if (await maintenance.isVisible().catch(() => false)) {
        throw new Error(`BackOffice is down for maintenance (HTTP 503 page): ${this.url}`);
      }
      if (await forbidden.isVisible().catch(() => false)) {
        throw new Error(`BackOffice denied access before login (HTTP 403): ${this.url}`);
      }

      const surface = await Promise.any([
        usernameInput.waitFor({ state: "visible", timeout: 15000 }).then(() => "login"),
        directPerspective.waitFor({ state: "visible", timeout: 15000 }).then(() => "direct-admin"),
        maintenance.waitFor({ state: "visible", timeout: 15000 }).then(() => "maintenance"),
        forbidden.waitFor({ state: "visible", timeout: 15000 }).then(() => "forbidden"),
      ]).catch(() => "processing");

      if (surface === "maintenance") {
        throw new Error(`BackOffice is down for maintenance (HTTP 503 page): ${this.url}`);
      }
      if (surface === "forbidden") {
        throw new Error(`BackOffice denied access before login (HTTP 403): ${this.url}`);
      }
      if (surface === "login" || surface === "direct-admin") {
        return { surface, usernameInput, passwordInput, directPerspective };
      }

      if (attempt < 3) {
        await this.page.waitForTimeout(3000);
        continue;
      }
    }

    throw new Error(
      `BackOffice login shell remained stuck before credentials after 3 controlled loads; current URL: ${this.page.url()}`
    );
  }

  async login({ username, password, authority }) {
    if (!username || !password) {
      throw new Error("BACKOFFICE_USERNAME and BACKOFFICE_PASSWORD are required at runtime.");
    }
    const authorityLabel = BACKOFFICE_AUTHORITIES[authority];
    if (!authorityLabel) throw new Error(`Unsupported BackOffice authority: ${authority}`);

    const { surface, usernameInput, passwordInput, directPerspective } = await this.openLoginSurface();

    if (surface === "direct-admin") {
      if (authority !== "admin") {
        throw new Error(
          "BackOffice opened directly in Administration Cockpit; an agent authority is unavailable."
        );
      }
      await this.expectPerspective(authority);
      const expectedHost = new URL(this.url).hostname;
      if (new URL(this.page.url()).hostname !== expectedHost) {
        throw new Error(
          `BackOffice redirected to the wrong environment: expected ${expectedHost}, got ${new URL(this.page.url()).hostname}.`
        );
      }
      return;
    }

    await usernameInput.click();
    await usernameInput.pressSequentially(username, { delay: 35 });
    await usernameInput.press("Tab");
    await passwordInput.pressSequentially(password, { delay: 35 });
    await passwordInput.press("Tab");
    await this.page.waitForFunction(() => !window.zk || !zk.processing, null, { timeout: 10000 }).catch(() => {});
    await this.page.getByRole("button", { name: "Sign In", exact: true }).click();

    const proceedButton = this.page.getByRole("button", { name: "PROCEED", exact: true });
    // A timed-out loser must not reject the whole login while another
    // legitimate outcome is still loading (ZK often redirects via custom-login).
    const loginOutcome = await Promise.any([
      proceedButton
        .waitFor({ state: "visible", timeout: 60000 })
        .then(() => "authority"),
      directPerspective
        .waitFor({ state: "visible", timeout: 60000 })
        .then(() => "direct-admin"),
      this.page
        .waitForURL(/login\.zul\?login_error=1/, { timeout: 60000 })
        .then(() => "rejected"),
    ]).catch(() => {
      throw new Error(
        `BackOffice login did not reach an authenticated perspective or authority selector; current URL: ${this.page.url()}`
      );
    });
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
    const expectedHost = new URL(this.url).hostname;
    if (new URL(this.page.url()).hostname !== expectedHost) {
      throw new Error(
        `BackOffice redirected to the wrong environment: expected ${expectedHost}, got ${new URL(this.page.url()).hostname}.`
      );
    }
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
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const row = this.page.getByRole("row", {
      name: new RegExp(`^${escapedName}(?: selected)?$`),
    });
    await row.waitFor({ state: "visible", timeout: 30000 });
    await row.click();
  }
}
