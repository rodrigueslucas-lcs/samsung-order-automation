const { sanitize } = require("../reporting/evidence/sanitizer");

const MUTATING_METHOD = /^(POST|PUT|PATCH|DELETE)$/i;
const BUSINESS_URL = /(?:\/cart(?:s|\/|\?|$)|\/entries(?:\/|\?|$)|checkout|delivery|address|payment|submitOrder|\/orders(?:\/|\?|$))/i;

function parseBody(text) {
  if (!text) return null;
  const limited = String(text).slice(0, 16000);
  try {
    return JSON.parse(limited);
  } catch {
    return limited;
  }
}

async function serializeExchange(response) {
  const request = response.request();
  const contentType = String(response.headers()["content-type"] || "");
  let responseBody = null;
  if (/json|text/i.test(contentType)) {
    responseBody = await response.text().then(parseBody).catch(() => null);
  }
  const requestBody = parseBody(request.postData());
  return sanitize({
    method: request.method(),
    url: request.url(),
    status: response.status(),
    request: {
      contentType: request.headers()["content-type"] || null,
      body: requestBody,
    },
    response: {
      contentType: contentType || null,
      body: responseBody,
    },
  });
}

async function attachJson(testInfo, name, value) {
  if (!testInfo?.attach) return;
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(sanitize(value), null, 2)),
    contentType: "application/json",
  });
}

async function captureBusinessExchange(page, testInfo, name, action, { matcher = BUSINESS_URL, max = 8 } = {}) {
  const pending = [];
  const onResponse = (response) => {
    const request = response.request();
    if (!MUTATING_METHOD.test(request.method()) && !matcher.test(request.url())) return;
    if (!matcher.test(request.url())) return;
    pending.push(serializeExchange(response));
  };

  page.on("response", onResponse);
  try {
    return await action();
  } finally {
    await page.waitForTimeout(250).catch(() => {});
    page.off("response", onResponse);
    const settled = await Promise.allSettled(pending);
    const exchanges = settled
      .filter((item) => item.status === "fulfilled" && item.value)
      .map((item) => item.value)
      .slice(0, max);
    if (exchanges.length) await attachJson(testInfo, `${name} · Request-Response`, exchanges);
  }
}

async function attachProductContext(testInfo, config, extra = {}) {
  return attachJson(testInfo, "PE Product Context", {
    market: "PE",
    environment: config?.environment || process.env.PE_QST_ENVIRONMENT || null,
    sku: config?.sku || null,
    pdpUrl: config?.pdpUrl?.href || String(config?.pdpUrl || "") || null,
    cartUrl: config?.cartUrl?.href || String(config?.cartUrl || "") || null,
    ...extra,
  });
}

async function attachOrderEvidence(testInfo, data = {}) {
  return attachJson(testInfo, "PE Order Evidence", data);
}

module.exports = {
  BUSINESS_URL,
  captureBusinessExchange,
  attachProductContext,
  attachOrderEvidence,
};
