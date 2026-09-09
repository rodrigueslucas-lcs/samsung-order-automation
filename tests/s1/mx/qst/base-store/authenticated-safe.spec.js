import { test, expect } from "../../dst/base-store/mx.auth.fixture";

test("SAM-24962 + SAM-24963 @qst @mx @base-store @safe @registered - Login Home and My Account menu", async ({ page, mxConfig }) => {
  expect(new URL(page.url()).hostname).toBe(mxConfig.hostname);

  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await expect(profileButton).toBeVisible({ timeout: 60000 });
  await profileButton.hover();

  const menu = page
    .locator('[role="menu"].profile-menu')
    .filter({ visible: true })
    .last();
  await expect(menu).toBeVisible({ timeout: 30000 });

  const expectedOptions = [
    /My page|Mi p[aá]gina/i,
    /My Products|Mis productos/i,
    /My Rewards|Mis recompensas/i,
    /My Orders|Mis pedidos/i,
    /Wishlist|Lista de deseos/i,
    /My sub(?:s)?criptions|Mis suscripciones/i,
    /^Services$|^Servicios$/i,
    /Logout|Cerrar Sesi[oó]n/i,
  ];

  for (const option of expectedOptions) {
    await expect(menu.getByText(option).first()).toBeVisible({ timeout: 30000 });
  }
});
