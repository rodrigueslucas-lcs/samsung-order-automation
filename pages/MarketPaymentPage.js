import PaymentPage from "./PaymentPage";
import paymentMarketProfile from "../utils/paymentMarketProfile";

const { getPaymentMarketProfile } = paymentMarketProfile;

export default class MarketPaymentPage extends PaymentPage {
  constructor(page, { market } = {}) {
    super(page);
    this.marketProfile = getPaymentMarketProfile(market);
  }

  async navigateBackToCart() {
    const { cartPath } = this.marketProfile;
    const editCartLink = this.page.locator(`a[href="${cartPath}"]`).first();

    await editCartLink.waitFor({ state: "visible", timeout: 30000 });
    await editCartLink.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page.waitForURL((url) => url.pathname === cartPath, { timeout: 60000 }),
      editCartLink.click(),
    ]);
  }

  async placeOrderAndCapture(options = {}) {
    const { orderCodePattern } = this.marketProfile;
    return super.placeOrderAndCapture({
      ...options,
      orderCodePattern: options.orderCodePattern || orderCodePattern,
    });
  }
}
