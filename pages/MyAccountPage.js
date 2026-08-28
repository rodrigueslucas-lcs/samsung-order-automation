import { expect } from "@playwright/test";
import BasePage from "./BasePage";

const STAGING_ORIGIN = "https://stg2.shop.samsung.com";
const ALLOWED_SOURCE_HOSTS = new Set([
  "stg2.shop.samsung.com",
  "shop.samsung.com",
  "www.samsung.com",
]);

export function toStagingSamsungUrl(value) {
  const url = new URL(value, STAGING_ORIGIN);
  if (!ALLOWED_SOURCE_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing unexpected My Account host: ${url.hostname}`);
  }
  url.protocol = "https:";
  url.hostname = "stg2.shop.samsung.com";
  url.port = "";
  return url.toString();
}

export default class MyAccountPage extends BasePage {
  constructor(page) {
    super(page);
    this.routes = {
      root: "/pe/mypage",
      myProducts: "/pe/mypage/myproducts",
      rewards: "/pe/mypage/rewards",
      orders: "/pe/mypage/orders",
      wishlist: "/pe/mypage/wishlist",
      selectAi: "/pe/campaign/select-ai",
    };
  }

  assertStagingUrl(value = this.page.url()) {
    const url = new URL(value);
    if (url.hostname !== "stg2.shop.samsung.com") {
      throw new Error(`Refusing My Account interaction outside ST2: ${url.origin}`);
    }
    return url;
  }

  async openRoute(route) {
    const target = toStagingSamsungUrl(route);
    const response = await this.page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    this.assertStagingUrl();
    await expect(this.page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    return response;
  }

  async inspectRoute(route) {
    const responses = [];
    const failures = [];
    const consoleErrors = [];
    const onResponse = (response) => {
      const url = new URL(response.url());
      if (response.status() >= 400 || /mypage|users\/current|address|order|wishlist|cms/i.test(url.pathname)) {
        responses.push({
          method: response.request().method(),
          status: response.status(),
          endpoint: `${url.origin}${url.pathname}`,
        });
      }
    };
    const onFailed = (request) => {
      const url = new URL(request.url());
      failures.push({
        method: request.method(),
        endpoint: `${url.origin}${url.pathname}`,
        error: request.failure()?.errorText || "unknown",
      });
    };
    const onConsole = (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
    };
    this.page.on("response", onResponse);
    this.page.on("requestfailed", onFailed);
    this.page.on("console", onConsole);
    try {
      const response = await this.openRoute(route);
      await this.page.waitForTimeout(3000);
      const main = this.page.getByRole("main");
      const mainVisible = await main.isVisible().catch(() => false);
      const mainText = mainVisible
        ? (await main.innerText().catch(() => "")).replace(/\s+/g, " ").trim()
        : "";
      const headings = await this.page.getByRole("heading").allInnerTexts();
      const accountLinks = await this.page.locator("a[href]").evaluateAll((links) =>
        links
          .map((link) => {
            const url = new URL(link.href, window.location.origin);
            if (!/mypage|profile|address|wishlist|order/i.test(url.pathname)) return null;
            return {
              text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
              endpoint: `${url.origin}${url.pathname}`,
            };
          })
          .filter(Boolean)
          .slice(0, 30),
      );
      return {
        requestedPath: route,
        finalUrl: this.assertStagingUrl().origin + this.assertStagingUrl().pathname,
        documentStatus: response?.status() ?? null,
        title: await this.page.title(),
        headings: headings.slice(0, 10),
        mainVisible,
        mainTextLength: mainText.length,
        mainPreview: mainText.slice(0, 200),
        accountLinks,
        responses: responses.slice(-40),
        failures: failures.slice(-20),
        consoleErrors: consoleErrors.slice(-20),
      };
    } finally {
      this.page.off("response", onResponse);
      this.page.off("requestfailed", onFailed);
      this.page.off("console", onConsole);
    }
  }
}
