const { sanitize } = require("../reporting/evidence/sanitizer");

const BUSINESS_URL = /(?:\/cart(?:s|\/|\?|$)|\/entries(?:\/|\?|$)|checkout|delivery|address|payment|submitOrder|\/orders(?:\/|\?|$))/i;
const MAX_BODY_CHARS = 16000;

function parseBody(text) {
  if (!text) return null;
  const raw = String(text);
  try {
    const parsed = JSON.parse(raw);
    return sanitize(parsed);
  } catch {
    return sanitize(raw.slice(0, MAX_BODY_CHARS));
  }
}

function safeEndpoint(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl || "").split("?")[0];
  }
}

async function serializeExchange(response, { bodyTimeoutMs = 5000 } = {}) {
  const request = response.request();
  const responseContentType = String(response.headers()["content-type"] || "");
  const requestContentType = String(request.headers()["content-type"] || "");
  let responseBody = null;
  if (/json|text/i.test(responseContentType)) {
    let timer;
    try {
      responseBody = await Promise.race([
        response.text().then(parseBody).catch(() => null),
        new Promise(resolve => {
          timer = setTimeout(() => resolve({ unavailable: 'response-body-timeout' }), bodyTimeoutMs);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }
  const requestBody = parseBody(request.postData());
  return sanitize({
    method: request.method(),
    endpoint: safeEndpoint(request.url()),
    status: response.status(),
    ok: response.ok(),
    request: {
      contentType: requestContentType || null,
      body: requestBody,
    },
    response: {
      contentType: responseContentType || null,
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

async function captureBusinessExchange(page, testInfo, name, action, { matcher = BUSINESS_URL, max = 8, bodyTimeoutMs = 5000 } = {}) {
  const pending = [];
  const onResponse = (response) => {
    if (pending.length >= max || !matcher.test(response.request().url())) return;
    pending.push(serializeExchange(response, { bodyTimeoutMs }));
  };

  page.on("response", onResponse);
  try {
    return await action();
  } finally {
    await page.waitForTimeout(350).catch(() => {});
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
    pdpUrl: safeEndpoint(config?.pdpUrl?.href || String(config?.pdpUrl || "") || null),
    cartUrl: safeEndpoint(config?.cartUrl?.href || String(config?.cartUrl || "") || null),
    ...extra,
  });
}

async function attachOrderEvidence(testInfo, data = {}) {
  return attachJson(testInfo, "PE Order Evidence", {
    market: "PE",
    environment: process.env.PE_QST_ENVIRONMENT || process.env.TEST_ENV || null,
    ...data,
  });
}

module.exports = {
  BUSINESS_URL,
  safeEndpoint,
  serializeExchange,
  captureBusinessExchange,
  attachProductContext,
  attachOrderEvidence,
};
