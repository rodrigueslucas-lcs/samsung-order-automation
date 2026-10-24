// Submit each credential step once. A CAPTCHA/MFA or warm SSO return is a
// handoff, never a reason to submit email/password again or claim authentication.
async function completeAccountLogin(page, { market, hostname, credentials, timeout = 600000,
  now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log, resumeOnly = false }) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(hostname)) throw new Error('Account login requires a known staging market.');
  const report = message => log(`[auth:login:${market}] ${message}`);
  const email = page.locator('input#account, input[type="email"], input[name="email"], #iptLgnPlnID').filter({ visible: true }).first();
  const password = page.locator('input[type="password"], #iptLgnPlnPD').filter({ visible: true }).first();
  let emailSubmitted = false, passwordSubmitted = false, human = false, humanReported = false;
  let emailFilled = false, passwordFilled = false, captchaActivated = false;
  let resolvedCredentials;
  const configured = () => resolvedCredentials ||= (typeof credentials === 'function' ? credentials() : credentials) || {};
  const returned = () => {
    if (page.isClosed()) return true;
    try { const url = new URL(page.url()); return url.protocol === 'https:' && url.hostname === hostname && new RegExp(`^/${market}(?:/|$)`).test(url.pathname) && !/(?:^|\/)(?:login|callback|oauth)(?:\/|$)/i.test(url.pathname); }
    catch { return false; }
  };
  const deadline = now() + timeout;
  const captchaGate=async()=>{
    const visual=await page.locator('iframe[title*="challenge" i], iframe[title*="desaf" i], iframe[src*="bframe"]').filter({visible:true}).count();
    let pending=await page.locator('iframe[title="reCAPTCHA" i], iframe[title*="challenge" i], iframe[title*="desaf" i], iframe[src*="bframe"]').filter({visible:true}).count();
    let checkbox;
    if(pending&&!visual) {
      const count=await page.locator('iframe[title="reCAPTCHA" i]').filter({visible:true}).count();
      let completed=count>0&&count<=8;
      for(let index=0;index<Math.min(count,8);index++)try{
        const frames=page.frameLocator('iframe[title="reCAPTCHA" i]:visible');
        const frame=index===0?frames.first():frames.nth(index);
        const checked=await frame.getByRole('checkbox',{includeHidden:true}).getAttribute('aria-checked',{timeout:1000});
        if(checked!=='true'){completed=false;checkbox||=frame.getByRole('checkbox');}
      }catch{completed=false;}
      if(completed)pending=0;
    }
    return{visual,pending,checkbox};
  };
  try {
  while (now() < deadline) {
    if (returned()) return;
    // The provider may replace its document with about:blank while returning
    // from verification. Wait within the same deadline; never fill there.
    if (page.url() === 'about:blank') { await pause(250); continue; }
    const url = new URL(page.url());
    if (url.protocol !== 'https:') throw new Error('Samsung Account login requires HTTPS; no credentials were submitted.');
    if (url.hostname !== 'account.samsung.com') {
      // OAuth can briefly be on a staging callback, but credentials may only
      // ever be filled on the official Samsung Account host.
      if (url.hostname !== hostname && !url.hostname.endsWith('.ecom-stg.samsung.com')) throw new Error('Samsung Account reached an unexpected host; no credentials were submitted there.');
      await pause(250); continue;
    }
    let {visual:visualChallenge,pending:challenge,checkbox:captchaCheckbox}=await captchaGate();
    const mfa = await page.getByText(/Two-step verification|Verification code|c[oó]digo de verificaci[oó]n|Verificaci[oó]n en dos pasos/i).first().isVisible();
    if (mfa) {
      if (!humanReported) report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');
      humanReported=true;
      human = true; await pause(250); continue;
    }
    try {
    // A reCAPTCHA can be visible alongside the normal credentials form.
    // Populate the email once, but leave the password and submission until
    // the human completes the challenge. Never populate an MFA form.
    if (!resumeOnly && !emailSubmitted && !passwordSubmitted && !emailFilled && await email.isVisible()) {
      if (!configured().email) throw new Error('Configured Samsung Account email is unavailable.');
      await email.fill(configured().email); emailFilled = true;
    }
    if (challenge && !captchaActivated && !visualChallenge && !resumeOnly) {
      try {
        const checkbox = captchaCheckbox;
        if (checkbox && await checkbox.isVisible()) {
          captchaActivated = true; // one click after the widget has rendered
          await checkbox.click({ timeout: 5000 });
          report('CAPTCHA checkbox activated once; any challenge requires human completion.');
          ({visual:visualChallenge,pending:challenge}=await captchaGate());
        }
      } catch { /* The provider may already have replaced the frame; wait for its human gate. */ }
    }
    if (challenge) {
      if (visualChallenge&&!humanReported) {report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');humanReported=true;}
      human = true; await pause(250); continue;
    }
    human = false; humanReported=false;
    if (resumeOnly && !passwordSubmitted && !await password.isVisible()) {
      const pending = new Error('The retained Samsung login is not ready for a password-only continuation. No email or CAPTCHA action was repeated.');
      pending.exitCode = 79; throw pending;
    }
    if (!passwordSubmitted && !passwordFilled && await password.isVisible()) {
      if (!configured().password) throw new Error('Configured Samsung Account password is unavailable.');
      await password.fill(configured().password); passwordFilled = true;
    }
    if (!passwordSubmitted && await password.isVisible()) {
      report('completing the visible password step once');
      passwordSubmitted = true; // An ambiguous click is never submitted again on resume.
      await page.getByRole('button', { name: /^(?:Iniciar sesi[oó]n|Sign in|Continuar)$/i }).filter({ visible: true }).last().click({ timeout: 10000 });
    } else if (!resumeOnly && !emailSubmitted && !passwordSubmitted && await email.isVisible()) {
      report('completing the visible email step once');
      await page.getByRole('button', { name: /^(?:Siguiente|Next|Continuar|Sign in)$/i }).filter({ visible: true }).first().click({ timeout: 10000 });
      emailSubmitted = true;
    }
    } catch (error) {
      if (returned()) return;
      // A provider challenge can appear between observing the form and clicking
      // Next. Preserve the human gate rather than retrying an ambiguous submit.
      if ((await captchaGate().catch(()=>({pending:0}))).pending) {
        const gate = new Error('Samsung Account is awaiting human CAPTCHA/MFA. No credentials were retried.');
        gate.exitCode = 79; throw gate;
      }
      throw error;
    }
    await pause(250);
  }
  const error = new Error(human
    ? 'Samsung Account is awaiting human CAPTCHA/MFA. No credentials were retried and no session was marked READY.'
    : 'Samsung Account did not return before the bounded login wait. Inspect its window; credentials were not retried.');
  error.exitCode = human ? 79 : 1;
  throw error;
  } finally {
    try { log('AUTH_HANDOFF_AUDIT ' + JSON.stringify({ passwordAttempted: passwordSubmitted })); } catch {}
  }
}
module.exports = { completeAccountLogin };
