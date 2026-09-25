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
      preview: raw.slice(0, BODY_PREVIEW_LIMIT),
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw.slice(0, 4000);
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|auth|session|cookie|card|cvv|cvc|email/i.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return String(value || "");
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
        url: safeUrl(req.url()),
        body: requestBody !== undefined ? requestBody : parseBody(req.postData?.()),
      } : null,
      response: response ? {
        status: response.status(),
        ok: response.ok(),
        url: safeUrl(response.url()),
        body: explicitResponseBody !== undefined ? explicitResponseBody : await responseBody(response),
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
