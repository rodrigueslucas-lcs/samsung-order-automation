import sanitizer from "../reporting/evidence/sanitizer.js";

const { sanitize } = sanitizer;
const BODY_PREVIEW_LIMIT = 20000;

function parseBody(text) {
  if (!text) return null;
  const raw = String(text);
  if (raw.length > BODY_PREVIEW_LIMIT) {
    return {
      truncated: true,
      originalLength: raw.length,
      preview: sanitize(raw.slice(0, BODY_PREVIEW_LIMIT)),
    };
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return sanitize(raw.slice(0, 4000));
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value || "").split("?")[0];
  }
}

async function responseBody(response, timeout = 3000) {
  if (!response) return null;
  return Promise.race([
    response.text().then(parseBody).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve("[body unavailable within evidence timeout]"), timeout)),
  ]);
}

export async function attachNetworkEvidence(testInfo, name, { request, response, requestBody, responseBody: explicitResponseBody } = {}) {
  if (!testInfo?.attach) return null;

  try {
    const req = request || response?.request?.();
    const payload = sanitize({
      name,
      request: req ? {
        method: req.method(),
        endpoint: safeUrl(req.url()),
        body: requestBody !== undefined ? sanitize(requestBody) : parseBody(req.postData?.()),
      } : null,
      response: response ? {
        status: response.status(),
        ok: response.ok(),
        endpoint: safeUrl(response.url()),
        body: explicitResponseBody !== undefined ? sanitize(explicitResponseBody) : await responseBody(response),
      } : null,
      capturedAt: new Date().toISOString(),
    });

    await testInfo.attach(`API · ${name}`, {
      body: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
      contentType: "application/json",
    });
    return payload;
  } catch {
    return null;
  }
}

export { safeUrl };
