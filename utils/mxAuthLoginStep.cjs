function hasMxAccountReturned(page, hostname) {
  if (page.isClosed()) return true;
  try {
    const url = new URL(page.url());
    return url.hostname === hostname && /^\/mx(?:\/|$)/i.test(url.pathname);
  } catch { return false; }
}

async function waitForMxAccountField(page, field, {
  hostname,
  timeout = 120000,
  now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    // Return is a handoff to the authenticated-profile check, never auth proof.
    if (hasMxAccountReturned(page, hostname)) return "returned";
    if (await field.isVisible().catch(() => false)) return "field";
    await pause(250);
  }
  throw new Error("Samsung Account did not expose the required login field or return to the selected MX storefront before the deadline. Check CAPTCHA/MFA in its window.");
}

function redactMxAuthError(error) {
  // Locator call logs can embed complete OAuth callback URLs. Log no stack/log.
  return String(error?.message || error).split("\n", 1)[0]
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
}

module.exports = { hasMxAccountReturned, waitForMxAccountField, redactMxAuthError };
