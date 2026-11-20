import { expect } from "@playwright/test";
import BasePage from "./BasePage";

const ORIGIN = "https://stg2.shop.samsung.com";
const CMS_LINK_HOSTS = new Set(["stg2.shop.samsung.com", "www.samsung.com", "shop.samsung.com", "p6-pre-qa.samsung.com"]);

export default class MxMyAccountPage extends BasePage {
  assertScope() {
    const url = new URL(this.page.url());
    if (url.origin !== ORIGIN || !url.pathname.startsWith("/mx/")) {
      throw new Error("MX account navigation requires the S2 MX storefront.");
    }
  }

  async openProfileSettings() {
    this.assertScope();
    await this.page.goto(`${ORIGIN}/mx/mypage/profile-setting`, { waitUntil: "domcontentloaded", timeout: 60000 });
    this.assertScope();
    await expect(this.page).toHaveURL(`${ORIGIN}/mx/mypage/profile-setting`);
    await this.page.getByRole("heading", { name: "Ajustes de perfil", exact: true })
      .waitFor({ state: "visible", timeout: 60000 });
  }

  async validateNavigation({ timeout = 30000 } = {}) {
    this.assertScope();
    const navigation = this.page.locator("ul.lower-nav-links-mx").filter({ visible: true }).first();
    await navigation.waitFor({ state: "visible", timeout });
    const options = [
      { name: /^Mi cuenta$/i, path: /^\/mx\/mypage\/?$/ },
      { name: /^Mis productos$/i, path: /^\/mx\/mypage\/myproducts\/?$/ },
      { name: /^Mis Rewards$/i, path: /^\/mx\/mypage\/rewards\/?$/ },
      { name: /^Mis (?:[oó]rdenes|pedidos)$/i, path: /^\/mx\/mypage\/orders\/?$/ },
      { name: /^Wish\s?List$/i, path: /^\/mx\/mypage\/wishlist\/?$/ },
      { name: /^Mis Suscripciones$/i, path: /^\/mx\/mypage\/subscriptions\/?$/ },
    ];
    const evidence = [];
    for (const option of options) {
      const link = navigation.getByRole("link", { name: option.name }).first();
      await expect(link, `MX account navigation must expose ${option.name}`).toBeVisible({ timeout });
      const href = await link.getAttribute("href");
      if (!href) throw new Error("MX account navigation contains a link without a destination.");
      const target = new URL(href, ORIGIN);
      // CMS navigation contains Production/PreQA absolute URLs even in S2.
      // This menu TC checks their labels/paths, without following those links.
      if (target.protocol !== "https:" || !CMS_LINK_HOSTS.has(target.hostname) || !option.path.test(target.pathname)) {
        throw new Error(`MX account option ${option.name} has an unexpected destination.`);
      }
      evidence.push({ label: (await link.innerText()).trim(), path: target.pathname });
    }
    return evidence;
  }
}
