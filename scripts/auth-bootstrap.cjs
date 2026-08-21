const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const setupUrl = "https://stg2.shop.samsung.com/getcookie.html";
const homeUrl = "https://stg2.shop.samsung.com/pe/";
const profileDir = path.resolve("playwright/profiles/st2-peru-qa");
const authDir = path.resolve("playwright/.auth");
const authFile = path.join(authDir, "user.json");

async function openProfileMenu(page) {
  const profileButton = page.getByRole("button", {
    name: "My Profile",
    exact: true,
  });

  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  await profileButton.click();

  const menu = page
    .locator(".cdk-overlay-pane")
    .filter({ visible: true })
    .getByRole("menu");
  await menu.waitFor({ state: "visible", timeout: 30000 });

  await menu
    .locator(".mat-menu-panel-animating")
    .waitFor({ state: "detached", timeout: 30000 });

  return menu;
}

async function validateAuthenticatedSession(page) {
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  const menu = await openProfileMenu(page);
  const logout = menu.getByText("Cerrar sesión", { exact: true });

  await logout.waitFor({ state: "visible", timeout: 30000 });
}

async function bootstrapAuthentication() {
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(authDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("Opening the required ST2 cookie setup...");

    await page.goto(setupUrl, { waitUntil: "domcontentloaded" });
    await page
      .getByText(/You can access pages now/i)
      .waitFor({ state: "visible", timeout: 60000 });

    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

    const menu = await openProfileMenu(page);
    const logout = menu.getByText("Cerrar sesión", { exact: true });
    const login = menu
      .locator('a[data-an-la="login"]')
      .filter({ visible: true });

    await logout.or(login).waitFor({ state: "visible", timeout: 30000 });

    if (!(await logout.isVisible())) {
      await page.keyboard.press("Escape");

      console.log("");
      console.log("Open My Profile and click Iniciar sesión manually.");
      console.log("The script will detect the Samsung Account navigation.");
      console.log("");

      await page.waitForURL(/account\.samsung\.com/, {
        timeout: 5 * 60 * 1000,
      });

      console.log("");
      console.log("Complete Samsung Account login manually in this Chrome.");
      console.log("Google/FedCM, CAPTCHA, MFA, approval and SMS remain human steps.");
      console.log("The script will continue after Samsung redirects back to ST2.");
      console.log("");

      await page.waitForURL(/stg2\.shop\.samsung\.com\/pe\//, {
        timeout: 15 * 60 * 1000,
        waitUntil: "domcontentloaded",
      });
    }

    await validateAuthenticatedSession(page);

    await context.storageState({
      path: authFile,
      indexedDB: true,
    });

    console.log("Authenticated state saved to playwright/.auth/user.json");
    console.log("The state and dedicated QA profile are ignored by Git.");
  } finally {
    await context.close();
  }
}

bootstrapAuthentication().catch(() => {
  console.error(
    "Authentication bootstrap failed. Existing auth state, if any, was not changed."
  );
  process.exitCode = 1;
});
