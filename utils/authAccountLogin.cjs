// Submit each credential step once. A CAPTCHA/MFA or warm SSO return is a
// handoff, never a reason to submit email/password again or claim authentication.
async function completeAccountLogin(page, { market, hostname, credentials, timeout = 600000,
  now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(hostname)) throw new Error('Account login requires a known staging market.');
  const report = message => log(`[auth:login:${market}] ${message}`);
  const email = page.locator('input#account, input[type="email"], input[name="email"], #iptLgnPlnID').filter({ visible: true }).first();
  const password = page.locator('input[type="password"], #iptLgnPlnPD').filter({ visible: true }).first();
  let emailSubmitted = false, passwordSubmitted = false, human = false;
  let resolvedCredentials;
  const configured = () => resolvedCredentials ||= (typeof credentials === 'function' ? credentials() : credentials) || {};
  const returned = () => {
    if (page.isClosed()) return true;
    try { const url = new URL(page.url()); return url.protocol === 'https:' && url.hostname === hostname && new RegExp(`^/${market}(?:/|$)`).test(url.pathname) && !/(?:^|\/)(?:login|callback|oauth)(?:\/|$)/i.test(url.pathname); }
    catch { return false; }
  };
  const deadline = now() + timeout;
  while (now() < deadline) {
    if (returned()) return;
    const url = new URL(page.url());
    if (url.protocol !== 'https:') throw new Error('Samsung Account login requires HTTPS; no credentials were submitted.');
    if (url.hostname !== 'account.samsung.com') {
      // OAuth can briefly be on a staging callback, but credentials may only
      // ever be filled on the official Samsung Account host.
      if (url.hostname !== hostname && !url.hostname.endsWith('.ecom-stg.samsung.com')) throw new Error('Samsung Account reached an unexpected host; no credentials were submitted there.');
      await pause(250); continue;
    }
    const challenge = await page.locator('iframe[title="reCAPTCHA" i], iframe[title*="challenge" i], iframe[title*="desaf" i], iframe[src*="bframe"]').filter({ visible: true }).count();
    const mfa = await page.getByText(/Two-step verification|Verification code|c[oó]digo de verificaci[oó]n|Verificaci[oó]n en dos pasos/i).first().isVisible();
    if (challenge || mfa) {
      if (!human) report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');
      human = true; await pause(250); continue;
    }
    human = false;
    try {
    if (!passwordSubmitted && await password.isVisible()) {
      if (!configured().password) throw new Error('Configured Samsung Account password is unavailable.');
      report('completing the visible password step once');
      await password.fill(configured().password);
      await page.getByRole('button', { name: /^(?:Iniciar sesi[oó]n|Sign in|Continuar)$/i }).filter({ visible: true }).last().click({ timeout: 10000 });
      passwordSubmitted = true;
    } else if (!emailSubmitted && !passwordSubmitted && await email.isVisible()) {
      if (!configured().email) throw new Error('Configured Samsung Account email is unavailable.');
      report('completing the visible email step once');
      await email.fill(configured().email);
      await page.getByRole('button', { name: /^(?:Siguiente|Next|Continuar|Sign in)$/i }).filter({ visible: true }).first().click({ timeout: 10000 });
      emailSubmitted = true;
    }
    } catch (error) { if (returned()) return; throw error; }
    await pause(250);
  }
  const error = new Error(human
    ? 'Samsung Account is awaiting human CAPTCHA/MFA. No credentials were retried and no session was marked READY.'
    : 'Samsung Account did not return before the bounded login wait. Inspect its window; credentials were not retried.');
  error.exitCode = human ? 79 : 1;
  throw error;
}
module.exports = { completeAccountLogin };
