// Submit each credential step once. A CAPTCHA/MFA or warm SSO return is a
// handoff, never a reason to submit email/password again or claim authentication.
async function completeAccountLogin(page, { market, hostname, credentials, timeout = 600000,
  now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log, resumeOnly = false, resumeEmailPhase = 'NONE', passwordAlreadySubmitted = false }) {
  if (!['mx', 'pe', 'co', 'cl'].includes(market) || !['stg.shop.samsung.com', 'stg2.shop.samsung.com'].includes(hostname)) throw new Error('Account login requires a known staging market.');
  const report = message => log(`[auth:login:${market}] ${message}`);
  const email = page.locator('input#account, input[type="email"], input[name="email"], #iptLgnPlnID').filter({ visible: true }).first();
  const password = page.locator('input[type="password"], #iptLgnPlnPD').filter({ visible: true }).first();
  if(!['NONE','READY','CHALLENGE'].includes(resumeEmailPhase))throw new Error('Invalid retained email phase.');
  let emailSubmitted = resumeOnly&&resumeEmailPhase==='CHALLENGE', passwordSubmitted = passwordAlreadySubmitted, human = false, humanReported = false;
  let emailFilled = resumeOnly&&resumeEmailPhase!=='NONE', passwordFilled = false, captchaActivated = false;
  let emailChallengePending = emailSubmitted, emailChallengeContinued = false;
  let emailRestored = false, termsSubmitted = false;
  let resolvedCredentials;
  const configured = () => resolvedCredentials ||= (typeof credentials === 'function' ? credentials() : credentials) || {};
  const returned = () => {
    if (page.isClosed()) return true;
    try { const url = new URL(page.url()); return url.protocol === 'https:' && url.hostname === hostname && new RegExp(`^/${market}(?:/|$)`).test(url.pathname) && !/(?:^|\/)(?:login|callback|oauth)(?:\/|$)/i.test(url.pathname); }
    catch { return false; }
  };
  const deadline = now() + timeout;
  // An invisible reCAPTCHA badge is present throughout legitimate sign-in.
  // It is not an interactive checkbox or proof that a challenge is pending.
  // Visual challenges remain independently detected, including invisible-v3
  // challenges that are presented after clicking Next or Sign in.
  const checkboxFrames='iframe[title="reCAPTCHA" i]:not(.grecaptcha-badge iframe):not([src*="size=invisible"])';
  const captchaGate=async()=>{
    const visual=await page.locator('iframe[title*="challenge" i], iframe[title*="desaf" i], iframe[src*="bframe"]').filter({visible:true}).count();
    const count=await page.locator(checkboxFrames).filter({visible:true}).count();
    let pending=visual+count;
    let checkbox;
    if(pending&&!visual) {
      let completed=count>0&&count<=8;
      for(let index=0;index<Math.min(count,8);index++)try{
        const frames=page.frameLocator(checkboxFrames+':visible');
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
    if (/^\/iam\/error(?:\/|$)/i.test(url.pathname)) {
      const error = new Error('Samsung Account rejected the current authorization. No credential step will be repeated on this error page; start a fresh authorized refresh.');
      error.code = 'AUTH_PROVIDER_ERROR';
      error.exitCode = 78;
      throw error;
    }
    let {visual:visualChallenge,pending:challenge,checkbox:captchaCheckbox}=await captchaGate();
    const mfa = await page.getByText(/Two-step verification|Verification code|c[oó]digo de verificaci[oó]n|Verificaci[oó]n en dos pasos/i).first().isVisible();
    if (mfa) {
      if (!humanReported) report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');
      humanReported=true;
      human = true; await pause(250); continue;
    }
    let formAction='';
    try {
    // A reCAPTCHA can be visible alongside the normal credentials form.
    // Populate the email once, but leave the password and submission until
    // the human completes the challenge. Never populate an MFA form.
    if (!resumeOnly && !passwordSubmitted && await email.isVisible() &&
        ((!emailSubmitted&&!emailFilled)||((emailChallengePending||human)&&!emailRestored&&(formAction='email-read',await email.inputValue({timeout:1500}))===''))) {
      if (!configured().email) throw new Error('Configured Samsung Account email is unavailable.');
      if(emailFilled)emailRestored=true;
      formAction='email-fill';
      await email.fill(configured().email,{timeout:2000}); emailFilled = true;formAction='';
      report('configured email populated');
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
      if(emailSubmitted&&!passwordSubmitted)emailChallengePending=true;
      if (visualChallenge&&!humanReported) {report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');humanReported=true;}
      human = true; await pause(250); continue;
    }
    human = false; humanReported=false;
    if (url.pathname === '/iam/sign-in/status/terms') {
      // Only the observed mandatory terms/privacy gate; no marketing consent.
      if (!termsSubmitted) {
        for (const id of ['TC', 'PN']) {
          const control = page.locator('#' + id);
          // The policy route commits before Samsung mounts its form.
          await control.waitFor({ state: 'attached', timeout: 10000 });
          if (await control.count() !== 1) { const error = new Error('Samsung policy gate changed; manual review required.'); error.exitCode = 79; throw error; }
          if (!await control.isChecked()) await page.locator('label').filter({ has: control }).click({ timeout: 5000 });
          if (!await control.isChecked()) throw new Error('Samsung required policy selection was not confirmed.');
        }
        termsSubmitted = true;
        report('accepting required updated terms and privacy once; optional consent unchanged');
        await page.getByRole('button', { name: /^(?:Acepto|Accept|I agree)$/i }).click({ timeout: 10000 });
      }
      await pause(250); continue;
    }
    if(resumeOnly&&resumeEmailPhase!=='NONE'&&await email.isVisible()&&!await password.isVisible()) {
      formAction='email-read';const value=(await email.inputValue({timeout:1500})).trim();formAction='';
      if(!value&&!emailRestored){formAction='email-fill';await email.fill(configured().email,{timeout:2000});formAction='';emailRestored=true;report('configured email restored after provider reset');}
      else if(value.toLowerCase()!==String(configured().email||'').trim().toLowerCase()) {
        const mismatch=new Error('Retained email does not match its configured identity; manual intervention required.');mismatch.exitCode=79;throw mismatch;
      }
    }
    if(emailChallengePending&&!emailChallengeContinued&&!passwordSubmitted&&await email.isVisible()&&!await password.isVisible()) {
      // Some provider forms keep the email step after Next triggers CAPTCHA.
      // A positively observed challenge->completed transition permits exactly
      // one continuation; a timeout/network failure never permits this click.
      emailChallengeContinued=true;
      report('continuing the email step once after completed CAPTCHA');
      await page.getByRole('button',{name:/^(?:Siguiente|Next|Continuar|Sign in)$/i}).filter({visible:true}).first().click({timeout:10000});
      await pause(250);continue;
    }
    if (resumeOnly && !passwordSubmitted && !await password.isVisible() && !await email.isVisible()) {
      // Samsung replaces both fields during the legitimate SPA transition.
      // Wait within the existing deadline without repeating any action.
      await pause(250); continue;
    }
    if (resumeOnly && !passwordSubmitted && !await password.isVisible() && resumeEmailPhase==='NONE' && await email.isVisible()) {
      const pending = new Error('The retained Samsung login is not ready for a password-only continuation. No email or CAPTCHA action was repeated.');
      pending.exitCode = 79; throw pending;
    }
    if (!passwordSubmitted && !passwordFilled && await password.isVisible()) {
      if (!configured().password) throw new Error('Configured Samsung Account password is unavailable.');
      await password.fill(configured().password,{timeout:2000}); passwordFilled = true;
      report('configured password populated');
    }
    // Visibility can change between awaits while Samsung hydrates the form.
    // A newly visible field must return through its fill branch before submit.
    if (!passwordSubmitted && passwordFilled && await password.isVisible()) {
      report('completing the visible password step once');
      passwordSubmitted = true; // An ambiguous click is never submitted again on resume.
      await page.getByRole('button', { name: /^(?:Iniciar sesi[oó]n|Sign in|Continuar)$/i }).filter({ visible: true }).last().click({ timeout: 10000 });
    } else if ((!resumeOnly||resumeEmailPhase==='READY') && !emailSubmitted && !passwordSubmitted && emailFilled && await email.isVisible()) {
      report('completing the visible email step once');
      emailSubmitted = true;
      await page.getByRole('button', { name: /^(?:Siguiente|Next|Continuar|Sign in)$/i }).filter({ visible: true }).first().click({ timeout: 10000 });
    }
    } catch (error) {
      if (returned()) return;
      // Samsung can replace the email form between visibility and inputValue/
      // fill. Move forward only when the password step positively appeared;
      // this never repeats Next, a password submission or an unknown timeout.
      if(error.name==='TimeoutError'&&formAction.startsWith('email-')&&!passwordSubmitted&&await password.isVisible()) {
        report('email form replaced by password step; continuing without another email submit');
        await pause(250);continue;
      }
      // A provider challenge can appear between observing the form and clicking
      // Next. Preserve the human gate rather than retrying an ambiguous submit.
      if ((await captchaGate().catch(()=>({pending:0}))).pending) {
        if(emailSubmitted&&!passwordSubmitted)emailChallengePending=true;
        human=true;
        if(!humanReported){report('CAPTCHA/MFA requires human completion in this window. The login and credentials will not be restarted.');humanReported=true;}
        await pause(250);continue;
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
    try { log('AUTH_HANDOFF_AUDIT ' + JSON.stringify({ passwordAttempted: passwordSubmitted,emailPhase:passwordSubmitted?'NONE':emailChallengePending&&!emailChallengeContinued?'CHALLENGE':emailFilled&&!emailSubmitted?'READY':'NONE' })); } catch {}
  }
}
async function discardRejectedAccountPages(context) {
  const rejected = context.pages().filter(page => {
    if (page.isClosed()) return false;
    try {
      const url = new URL(page.url());
      return url.protocol === 'https:' && url.hostname === 'account.samsung.com' && /^\/iam\/error(?:\/|$)/i.test(url.pathname);
    } catch { return false; }
  });
  for (const page of rejected) {
    // A new refresh must obtain a new authorization from the storefront.
    // Keep Chrome alive; never discard a live CAPTCHA, MFA or login form.
    if (context.pages().filter(candidate => !candidate.isClosed()).length === 1) await context.newPage();
    await page.close();
  }
  return rejected.length;
}
module.exports = { completeAccountLogin, discardRejectedAccountPages };
