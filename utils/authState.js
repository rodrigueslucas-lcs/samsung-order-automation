import fs from "node:fs";
import path from "node:path";

export const AUTH_STATE_PATH = path.resolve("playwright/.auth/user.json");

export function requireAuthState() {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error(
      "Authenticated ST2 state was not found. Run `npm run auth:bootstrap` and complete the Samsung Account login manually."
    );
  }

  return AUTH_STATE_PATH;
}

export async function validateAuthenticatedSession(page) {
  await page.goto("https://stg2.shop.samsung.com/pe/", {
    waitUntil: "domcontentloaded",
  });

  const maintenanceMessage = page.getByText(
    /SystemParking|Page Under Maintenance/i
  );

  if (await maintenanceMessage.count()) {
    throw new Error(
      "The saved ST2 setup cookie is no longer valid. Run `npm run auth:bootstrap` again."
    );
  }

  const profileButton = page.getByRole("button", {
    name: "My Profile",
    exact: true,
  });

  await profileButton.waitFor({ state: "visible", timeout: 60000 });
  await profileButton.click();

  const profileMenu = page
    .locator(".cdk-overlay-pane")
    .filter({ visible: true })
    .getByRole("menu");
  await profileMenu.waitFor({ state: "visible", timeout: 30000 });

  await profileMenu
    .locator(".mat-menu-panel-animating")
    .waitFor({ state: "detached", timeout: 30000 });

  const logout = profileMenu.getByText("Cerrar sesión", { exact: true });

  await logout
    .waitFor({ state: "visible", timeout: 30000 })
    .catch(() => {
      throw new Error(
        "The saved Samsung storefront session is expired. Run `npm run auth:bootstrap` again."
      );
    });
}
