async function waitForClAuthenticatedReturn(context, {
  hostname,
  accountPage,
  readAccountState,
  timeout = 600000,
  now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const deadline = now() + timeout;
  const signedOutChecks = new Map();
  while (now() < deadline) {
    // A popup login leaves the original signed-out storefront open. Its URL
    // alone must never satisfy the return condition or trigger a reload.
    const accountStillOpen = accountPage && !accountPage.isClosed() &&
      new URL(accountPage.url()).hostname === "account.samsung.com";
    if (!accountStillOpen) {
      for (const candidate of context.pages().slice().reverse()) {
        if (candidate.isClosed()) continue;
        let url;
        try { url = new URL(candidate.url()); } catch { continue; }
        if (url.hostname !== hostname || !/^\/cl(?:\/|$)/i.test(url.pathname)) continue;
        const state = await readAccountState(candidate);
        if (state.state === "authenticated") return candidate;
        if (state.state === "signed-out") {
          const checks = (signedOutChecks.get(candidate) || 0) + 1;
          signedOutChecks.set(candidate, checks);
          if (checks >= 3) {
            const error = new Error("CL Samsung Account returned to the storefront, but the profile remains signed-out after three checks. Session was not exported; inspect the SSO callback before another login.");
            error.exitCode = 78;
            throw error;
          }
          await pause(5000);
        }
      }
    }
    await pause(500);
  }
  throw new Error("CL login did not return an authenticated storefront before the deadline. Complete any Samsung Account CAPTCHA/MFA in the login window; a signed-out home tab is not sufficient.");
}

function validatedClSsoLoginUrl(info, { hostname, environment }) {
  let url;
  try { url = new URL(info?.ssoLoginUrl); } catch { throw new Error("CL backend did not provide a valid Samsung Account login URL."); }
  const provider = environment === "S2" ? "sec_stg_s2_smb" : "sec_stg_s1_smb";
  if (url.protocol !== "https:" || url.hostname !== "account.samsung.com" || url.pathname !== `/accounts/v1/${provider}/signInGate`) {
    throw new Error("CL backend SSO provider does not match the selected staging environment.");
  }
  for (const key of ["redirect_uri", "goBackURL"]) {
    let callback;
    try { callback = new URL(url.searchParams.get(key)); } catch { throw new Error("CL backend SSO callback is missing or invalid."); }
    if (callback.protocol !== "https:" || callback.hostname !== hostname || !callback.pathname.startsWith("/cl/login/")) {
      throw new Error("CL backend SSO callback leaves the selected CL staging storefront.");
    }
  }
  return url.href;
}

function assertClSsoConfiguration(configuration, ssoInfo, config) {
  if (!configuration || configuration.status < 400) return;
  if (ssoInfo && config) {
    validatedClSsoLoginUrl(ssoInfo, config);
    return;
  }
  const errorType = /^[A-Za-z0-9]+$/.test(configuration.errorType || "") ? configuration.errorType : "service error";
  const error = new Error(`CL storefront currentConfig failed (HTTP ${configuration.status}; ${errorType}). Samsung Account login cannot initialize. No credentials were submitted; repair the staging configuration before retrying.`);
  error.exitCode = 78;
  throw error;
}

async function waitForClCheckoutLoginStep(page, field, {
  hostname, timeout = 60000, now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    if (page.isClosed()) throw new Error("CL checkout login window closed before its result was proven.");
    let url;
    try { url = new URL(page.url()); } catch {}
    if (url?.protocol === "https:" && url.hostname === hostname && /^\/cl\/checkout\/one\/?$/i.test(url.pathname)) {
      // This is only a handoff. The caller must still prove delivery and logout.
      return "checkout";
    }
    if (url?.protocol === "https:" && url.hostname === "account.samsung.com" &&
      await field.isVisible().catch(() => false)) return "field";
    await pause(250);
  }
  throw new Error("CL Samsung Account did not expose the required field or return to checkout. Complete any CAPTCHA/MFA in its login window.");
}

module.exports = { waitForClAuthenticatedReturn, assertClSsoConfiguration, validatedClSsoLoginUrl, waitForClCheckoutLoginStep };
