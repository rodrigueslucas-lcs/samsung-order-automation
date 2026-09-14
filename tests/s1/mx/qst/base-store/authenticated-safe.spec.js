import evidenceContext from "../../../../../reporters/evidence/evidenceContext.js";
import qstEvidenceMetadata from "../../../../../utils/qstEvidenceMetadata.js";
import { test, expect } from "../../dst/base-store/mx.auth.fixture";

const { recordBusinessEvidence } = evidenceContext;
const { getMxQstEvidenceMetadata } = qstEvidenceMetadata;

async function openAuthenticatedMenu(page) {
  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await expect(profileButton).toBeVisible({ timeout: 60000 });
  await profileButton.hover();

  const menu = page
    .locator('[role="menu"].profile-menu')
    .filter({ visible: true })
    .last();
  await expect(menu).toBeVisible({ timeout: 30000 });
  return menu;
}

test("SAM-24962 @qst @mx @base-store @safe @registered - Login Home page", async ({ page, mxConfig }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24962"));

  const currentUrl = new URL(page.url());
  expect(currentUrl.hostname).toBe(mxConfig.hostname);
  expect(currentUrl.pathname).toMatch(/^\/mx\/?$/i);

  const profileButton = page.getByRole("button", { name: "My Profile", exact: true });
  await expect(profileButton).toBeVisible({ timeout: 60000 });

  recordBusinessEvidence(testInfo, {
    authenticated: true,
    landedOnHome: true,
    pathname: currentUrl.pathname,
  });
});

test("SAM-24963 @qst @mx @base-store @safe @registered - Validate My account menu", async ({ page }, testInfo) => {
  recordBusinessEvidence(testInfo, getMxQstEvidenceMetadata("SAM-24963"));

  const menu = await openAuthenticatedMenu(page);
  const expectedOptions = [
    /My page|Mi p[aá]gina|My Account|Mi cuenta/i,
    /My Products|Mis productos/i,
    /My Rewards|Mis recompensas|Mis Rewards/i,
    /My Orders|Mis pedidos/i,
    /Wishlist|Wish List|Lista de deseos/i,
    /My sub(?:s)?criptions|Mis suscripciones/i,
    /^Services$|^Servicios$/i,
    /Logout|Cerrar Sesi[oó]n/i,
  ];

  const menuText = (await menu.innerText()).replace(/\s+/g, " ").trim();
  for (const option of expectedOptions) {
    await expect(
      menu.getByText(option).first(),
      `Expected My Account option ${option} to be visible. Current menu: ${menuText}`
    ).toBeVisible({ timeout: 30000 });
  }

  recordBusinessEvidence(testInfo, {
    menuValidated: true,
    menuText,
  });
});
