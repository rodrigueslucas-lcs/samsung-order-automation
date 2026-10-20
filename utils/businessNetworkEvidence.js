import { attachNetworkEvidence } from "./networkEvidence";

const INSTALLED = Symbol.for("samsung.qst.businessNetworkEvidence");
const MAX_PER_KIND = 3;

function marketMatcher(market) {
  const code = String(market || "").toLowerCase();
  return new RegExp(`/(?:tokocommercewebservices/)?v?2?/?${code}/|/${code}/`, "i");
}

function classify(response, market) {
  const request = response.request();
  const method = request.method();
  const url = response.url();
  const marketPath = marketMatcher(market);
  if (!marketPath.test(url)) return null;
  // Add-to-cart POST has its own dedicated attachment in CO/CL product flows.
  if (method === "POST" && /\/carts?\/[^/]+\/entries(?:\?|$)/i.test(url)) return null;
  if (/\/carts?\/[^/]+\/entries(?:\/\d+)?(?:\?|$)/i.test(url)) return `Cart ${method}`;
  if (/\/carts?(?:\/|\?|$)/i.test(url)) return `Cart ${method}`;
  if (/deliverymodes|delivery|shipping|slots?/i.test(url)) return `Delivery ${method}`;
  if (/address|postal|postcode|municip|region/i.test(url)) return `Address ${method}`;
  if (/paymentmodes|payment|submitOrder/i.test(url)) return `Payment ${method}`;
  if (/\/orders(?:\/|\?|$)/i.test(url)) return `Order ${method}`;
  if (/checkout/i.test(url)) return `Checkout ${method}`;
  return null;
}

export function installBusinessNetworkEvidence(page, testInfo, market, { max = 18 } = {}) {
  if (!page || !testInfo?.attach || page[INSTALLED]) return;
  const counts = new Map();
  let captured = 0;

  const listener = (response) => {
    const kind = classify(response, market);
    if (!kind || captured >= max) return;
    const previous = counts.get(kind) || 0;
    if (previous >= MAX_PER_KIND) return;
    const count = previous + 1;
    counts.set(kind, count);
    captured += 1;
    void attachNetworkEvidence(testInfo, `${kind} #${count}`, { response });
  };

  page[INSTALLED] = { listener, market };
  page.on("response", listener);
}

export { classify };
