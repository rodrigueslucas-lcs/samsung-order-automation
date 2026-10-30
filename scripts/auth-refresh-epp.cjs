const {installEppOverlayDismissal,dismissEppNotificationTutorial}=require('../utils/eppStorefrontOverlays.cjs');
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { getEppConfig } = require("../config/markets/epp");
const { getEppSessionPaths, getPrimaryEppCredentials, persistVerifiedEppSession, captureEppPageState, acquireEppLease, eppLoginResumeOptions } = require("../utils/eppSession.cjs");
const { verifyEppSnapshot, recoverEppParkingReturn } = require("../utils/eppSessionVerification.cjs");
const { connectAuthBrowser } = require("../utils/authDedicatedBrowser.cjs");
const { prepareAuthBrowserWindow } = require("../utils/authBrowserWindow.cjs");
const { authProfileControl, openAuthProfile } = require("../utils/authStorefrontReady.cjs");
const { completeAccountLogin, discardRejectedAccountPages } = require("../utils/authAccountLogin.cjs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const { proveEppAccess: observe, findEppVerifiedContinue, eppAccountLoginAction, configuredEppAuthEntry } = require("../utils/eppAccessState.cjs");
const { installEppNavigationGuard } = require('../utils/eppNavigationGuard.cjs');

function isEppPage(page, config) {
  try { const url = new URL(page.url()); return !page.isClosed() && url.origin === config.rootUrl.origin && url.pathname.startsWith(config.rootUrl.pathname); }
  catch { return false; }
}

async function needsEppBootstrap(page,config) {
  if(!isEppPage(page,config))return true;
  // A retained blank document is not a rendered programme. Recover staging
  // setup once; a rendered page (including an external gate) stays in place.
  try{return !(await page.locator('body').innerText({timeout:3000})).trim();}
  catch{return false;}
}

async function prepareEppCookie(page,config){
  const target=new URL('/getcookie.html',config.rootUrl);
  const ready=page.getByText(/You can access pages now/i).filter({visible:true}).first();
  const alreadyReady=async()=>{try{const u=new URL(page.url());return u.origin===target.origin&&u.pathname===target.pathname&&await ready.isVisible();}catch{return false;}};
  if(!(await alreadyReady())){
    try{await page.goto(target.href,{waitUntil:'commit',timeout:30000});}
    catch(error){if(!(await alreadyReady()))throw error;}
  }
  await ready.waitFor({timeout:15000});
}

async function reuseNativeEppSession(config,{capture=require('../utils/authBrowserLifecycle.cjs').captureAuthBrowser,verify=verifyEppSnapshot,persist=persistVerifiedEppSession,credentials=getPrimaryEppCredentials}={}) {
  const files=getEppSessionPaths(config);
  const owned=await capture({market:config.market.toLowerCase(),environment:config.environment,slot:config.authSlot||'primary'},{profilesRoot:path.dirname(files.profile)});
  if(!owned)return false;
  try{
    const snapshot=await owned.readEppSnapshot(config.rootUrl.href);
    if(!snapshot)return false;
    const verified=await verify(config,snapshot,{expectedEmail:credentials(config).email,timeout:30000});
    persist(config,verified);
    await owned.closeVerified();
    return true;
  }finally{await owned.dispose();}
}

function assertEppAuthContinuation(page, guard) {
  const blocked = guard?.lastBlocked();
  if (blocked) throw Object.assign(new Error('EPP navigation denied; no login retry.'), {exitCode:78,eppReason:blocked.reason});
  const url = new URL(page.url());
  if (url.hostname === 'account.samsung.com' && /^\/iam\/blocked(?:\/|$)/i.test(url.pathname)) {
    throw Object.assign(new Error('Samsung Account security denied this authorization; operator review required.'), {exitCode:78,eppReason:'SAMSUNG_ACCOUNT_SECURITY_BLOCKED'});
  }
}

function readHandoff(files) {
  if (!fs.existsSync(files.handoff)) return {};
  try { return JSON.parse(fs.readFileSync(files.handoff, "utf8")); }
  catch { throw Object.assign(new Error("EPP handoff ownership/state requires manual review."), { exitCode: 79, eppReason: "HANDOFF_STATE_UNKNOWN" }); }
}

async function refresh(market, environment) {
  const config = getEppConfig(market, { ...process.env, ENVIRONMENT: environment, [`${String(market).toUpperCase()}_QST_ENVIRONMENT`]:environment });
  if(config.programPolicy?.allowAutomaticRetry===false&&(process.env.EPP_AUTH_MAINTENANCE==='1'||config.programPolicy.knownStatus!=='AUTHENTICATED_STOREFRONT_ENTITLEMENT_UNKNOWN'))throw Object.assign(new Error('Programme is excluded from automatic login; independent investigation required.'),{exitCode:78,eppReason:config.programPolicy.knownStatus});
  const resumeOnly = process.env.EPP_AUTH_RESUME_ONLY === '1';
  const interactiveTimeout = Number(process.env.EPP_AUTH_INTERACTIVE_TIMEOUT_MS || 600000);
  if (!Number.isFinite(interactiveTimeout) || interactiveTimeout < 1000 || interactiveTimeout > 600000) throw new Error('Invalid EPP interactive timeout.');
  const files = getEppSessionPaths(config);
  const credentials = getPrimaryEppCredentials(config);
  const lease = acquireEppLease(config);
  fs.mkdirSync(files.directory, { recursive: true });
  let browser, guard, success = false, startedNewAccountFlow = false, stage = "CONNECT_BROWSER";
  const report = message => console.log(`[auth:epp] ${config.market} ${config.environment} ${config.authSlot === 'second' ? 'SECOND' : 'FIRST'} · ${message}`);
  try {
    // The operator may have renewed the owned native profile after the export.
    // Capture and independently verify that state before consulting a stale file.
    let nativeInvalid=false;
    try{
      if(await reuseNativeEppSession(config)){report('READY · current owned programme browser verified and captured; no login');return;}
    }catch(error){
      if(!['SERVER_AUTH_REJECTED','SERVER_IDENTITY_NOT_PROVEN'].includes(error.eppReason))throw error;
      nativeInvalid=true;
    }
    if(fs.existsSync(files.metadata)&&!nativeInvalid){
      try{
        const verified=await verifyEppSnapshot(config,require('../utils/eppSession.cjs').loadEppSession(config),{expectedEmail:credentials.email,timeout:20000});
        persistVerifiedEppSession(config,verified);report('READY · current programme session reused; no login window');return;
      }catch(error){
        if(!['SERVER_AUTH_REJECTED','SERVER_IDENTITY_NOT_PROVEN'].includes(error.eppReason))throw error;
      }
    }
    report("START · isolated EPP profile; no Base Store state imported");
    browser = await connectAuthBrowser({ chromium, profileDir: files.profile, market: config.market.toLowerCase(), environment: config.environment,slot:config.authSlot||'primary' }, {
      log: () => {},
      launch: () => {
        if (resumeOnly) throw Object.assign(new Error('Retained EPP browser is unavailable; no login restart.'), { exitCode: 79, eppReason: 'EPP_HANDOFF_BROWSER_MISSING' });
        const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe")].find(file => fs.existsSync(file));
        if (!chrome) throw new Error("Chrome executable is unavailable.");
        const child = spawn(chrome, [`--user-data-dir=${files.profile}`, "--remote-debugging-port=0", "--disable-background-mode", "--start-maximized", "--no-first-run", "--no-default-browser-check", "--hide-crash-restore-bubble", "--new-window", "about:blank"], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
        return { status: 0 };
      },
    });
    const context = browser.contexts()[0];
    let callbackStatus=null;
    context.on('response',response=>{
      if(config.programPolicy.callbackBehavior!=='BROKEN_400_RECOVER_CANONICAL'||response.status()!==400)return;
      const url=new URL(response.url());
      if(url.origin===config.rootUrl.origin&&/^\/login\/returnURL\/?$/i.test(url.pathname))callbackStatus='BROKEN_400';
    });
    guard = await installEppNavigationGuard(context,config);
    await discardRejectedAccountPages(context);
    let page = context.pages().find(candidate => { try { return new URL(candidate.url()).hostname === "account.samsung.com"; } catch { return false; } });
    if (!page) {
      stage = "STAGING_BOOTSTRAP";
      page = context.pages().find(candidate => isEppPage(candidate, config)) || context.pages()[0] || await context.newPage();
      await guard.protectPage(page);
      await installEppOverlayDismissal(page,config);
      await prepareAuthBrowserWindow(page);
      // Resume an owned registration/verification dialog in place. Navigation
      // would discard its successful code confirmation and could repeat work.
      if (await needsEppBootstrap(page, config)) {
        await prepareEppCookie(page,config);
        await page.goto(config.rootUrl.href, { waitUntil: "commit", timeout: 60000 });
      } else if (new URL(page.url()).pathname !== config.rootUrl.pathname && !/\/auth\/multistore\/?$|\/registration\/?$/.test(new URL(page.url()).pathname)) {
        // Auth is proven on the EPP home, independently of a particular SKU.
        // Resume verification dialogs in place; never lose their positive result.
        await page.goto(config.rootUrl.href, { waitUntil: "commit", timeout: 60000 });
      } else if (config.accessMode === "corporate-email-link" && readHandoff(files).corporateLinkRequestedAt) {
        await page.goto(config.rootUrl.href, { waitUntil: "commit", timeout: 60000 });
      }
      const login = eppAccountLoginAction(page);
      const entryWait=config.identityEntryUrl?15000:60000;
      await Promise.any([login.waitFor({ timeout: entryWait }), page.locator('input[type="email"]:visible').first().waitFor({ timeout: entryWait }), page.getByRole("textbox", { name: /c[oó]digo|verification/i }).first().waitFor({ timeout: entryWait }), authProfileControl(page).waitFor({ state: "visible", timeout: entryWait })]).catch(() => {});
      const officialEntry=configuredEppAuthEntry(config,{url:page.url(),loginVisible:await login.isVisible(),profileVisible:await authProfileControl(page).isVisible(),emailVisible:await page.locator('input[type="email"]:visible').first().isVisible(),codeVisible:await page.getByRole('textbox',{name:/c[oó]digo|verification/i}).or(page.getByPlaceholder(/c[oó]digo|verification/i)).first().isVisible(),pendingVerification:Boolean(await findEppVerifiedContinue(page))});
      if(officialEntry){
        report('opening the configured programme auth entry once; homepage has no login action');
        await page.goto(officialEntry.href,{waitUntil:'commit',timeout:60000});
        assertEppAuthContinuation(page,guard);
        await login.waitFor({state:'visible',timeout:30000});
      }
      let loginAction = await login.isVisible() ? login : null;
      if (!loginAction && await authProfileControl(page).isVisible()) {
        const profile = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
        if (profile.state === "signed-out") loginAction = profile.login;
      }
      if(!loginAction&&config.identityEntryUrl){
        // Observed common Samsung identity entry, inside this isolated EPP
        // profile. No Base Store state is imported or accepted as EPP proof.
        stage='SAMSUNG_IDENTITY_ENTRY';
        await page.goto(config.identityEntryUrl.href,{waitUntil:'commit',timeout:30000});
        await authProfileControl(page).waitFor({state:'visible',timeout:30000});
        const identity=await openAuthProfile(page,{market:config.market.toLowerCase(),prepareWindow:async()=>{}});
        if(identity.state==='signed-out')loginAction=identity.login;
        else if(identity.state==='authenticated')await page.goto(config.rootUrl.href,{waitUntil:'commit',timeout:30000});
        else throw Object.assign(new Error('Samsung identity entry is not ready; no blind authorization.'),{exitCode:79,eppReason:'EPP_IDENTITY_ENTRY_NOT_READY'});
      }
      if (loginAction) {
        if (resumeOnly) throw Object.assign(new Error('Retained EPP login is not in progress; no new authorization.'), { exitCode: 79, eppReason: 'EPP_HANDOFF_NOT_READY' });
        stage = "EPP_LOGIN_ACTION";
        report("opening the official EPP Samsung Account action once");
        await page.waitForFunction(() => typeof window.samsung?.account?.signIn === "function", null, { timeout: 30000 });
        // A new login action from the signed-out EPP page is a new handoff.
        // Preserve corporate activation bookkeeping, never a prior login's
        // email/password progress. Existing Account pages retain their audit.
        const prior = readHandoff(files);
        writeJsonAtomically(files.handoff, { ...(prior.corporateLinkRequestedAt ? { corporateLinkRequestedAt: prior.corporateLinkRequestedAt } : {}), emailPhase: 'NONE', passwordAttempted: false });
        startedNewAccountFlow = true;
        await loginAction.click();
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          const account = context.pages().find(candidate => { try { return new URL(candidate.url()).hostname === "account.samsung.com"; } catch { return false; } });
          if (account) { page = account; break; }
          await page.waitForTimeout(250);
        }
      }
    }
    if (new URL(page.url()).hostname === "account.samsung.com") {
      stage = "SAMSUNG_ACCOUNT";
      const handoff = readHandoff(files);
      if (resumeOnly && config.authSlot !== 'second' && typeof handoff.passwordAttempted !== 'boolean') throw Object.assign(new Error('Retained EPP credential outcome is unknown; no replay.'),{exitCode:79,eppReason:'HANDOFF_STATE_UNKNOWN'});
      if (handoff.passwordAttempted && await page.locator('input[type="password"]:visible').count()) throw Object.assign(new Error("Previous password outcome requires manual review; no repeat submit."), { exitCode: 79 });
      await prepareAuthBrowserWindow(page);
      report("Samsung Account opened; human CAPTCHA/MFA only");
      assertEppAuthContinuation(page,guard);
      if (config.authSlot === 'second') {
        await require('../utils/authAccountQr.cjs').openSecondAccountQr(page, { slot: 'second', log: report });
        report('HUMAN_REQUIRED · scan with the SECOND identity; FIRST credentials are never entered');
        const deadline = Date.now() + interactiveTimeout;
        while (new URL(page.url()).hostname === 'account.samsung.com' && Date.now() < deadline) {
          assertEppAuthContinuation(page, guard);
          if (new URL(page.url()).pathname === '/iam/sign-in/status/terms') {
            await completeAccountLogin(page, { market: config.market.toLowerCase(), hostname: config.rootUrl.hostname, passwordAlreadySubmitted: true, resumeOnly: true, credentials: {}, timeout: Math.max(1000, deadline - Date.now()), log: report });
          } else await page.waitForTimeout(500);
        }
        if (new URL(page.url()).hostname === 'account.samsung.com') throw Object.assign(new Error('EPP SECOND needs human verification.'), {exitCode:79,eppReason:'EPP_SECOND_HUMAN_REQUIRED'});
      } else {
      try { await completeAccountLogin(page, { market: config.market.toLowerCase(), hostname: config.rootUrl.hostname, credentials,
        timeout: interactiveTimeout, passwordAlreadySubmitted: handoff.passwordAttempted === true, ...eppLoginResumeOptions(handoff, startedNewAccountFlow), ...(resumeOnly ? {resumeOnly:true} : {}),
        pause: async ms => { assertEppAuthContinuation(page,guard); await new Promise(resolve=>setTimeout(resolve,ms)); },
        log: message => {
          if (message.startsWith("AUTH_HANDOFF_AUDIT ")) {
            try { writeJsonAtomically(files.handoff, { ...readHandoff(files), ...JSON.parse(message.slice("AUTH_HANDOFF_AUDIT ".length)) }); } catch {}
          } else report(message.replace(/^\[auth:login:[^\]]+\]\s*/, ""));
        } }); } catch(error) {
          if(!(await recoverEppParkingReturn(page,config)))throw error;
          report('staging parking callback recovered once; Account submit was not repeated');
        }
      }
    }
    stage = "EPP_ACCESS";
    page = context.pages().find(candidate => isEppPage(candidate, config)) || context.pages().find(candidate => { try { return new URL(candidate.url()).origin === config.rootUrl.origin; } catch { return false; } }) || page;
    if (!isEppPage(page, config)) await page.goto(config.rootUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    if(callbackStatus)report('callback BROKEN_400 · canonical programme recovery once; login is not repeated');
    const email = page.locator('input[type="email"]:visible').first();
    const code = page.getByRole("textbox", { name: /verification|access code|c[oó]digo|clave de acceso/i }).or(page.getByPlaceholder(/verification|access code|c[oó]digo|clave de acceso/i)).filter({ visible: true }).first();
    const deadline = Date.now() + 60000;
    let state, codeSubmitted = false, confirmationAttempted = false;
    do {
      await installEppOverlayDismissal(page,config);
      const gate = await observe(page, config);
      if (gate.reason === 'VERIFICATION_CODE_REJECTED') throw Object.assign(new Error('Configured EPP code rejected; no repeat submit.'), { exitCode: 78, eppReason: gate.reason });
      const confirmation = confirmationAttempted ? null : await findEppVerifiedContinue(page);
      if (confirmation) {
        confirmationAttempted = true;
        codeSubmitted = true;
        report("EPP code accepted; continuing the verified-account dialog once");
        await confirmation.click();
      }
      await dismissEppNotificationTutorial(page,config);
      state = await observe(page, config);
      if (state.status === "READY") break;
      if (state.reason === "CORPORATE_ACTIVATION_REQUIRED") {
        if(!config.programPolicy.legacy)throw Object.assign(new Error('Selected programme needs external entitlement; registration is not repeated.'),{exitCode:78,eppReason:'CORPORATE_ACTIVATION_REQUIRED'});
        if (process.env.EPP_AUTH_MAINTENANCE === '1') throw Object.assign(new Error('EPP maintenance cannot request corporate activation.'), {exitCode:78,eppReason:'CORPORATE_ACTIVATION_REQUIRED'});
        await email.fill(credentials.email);
        const handoff = readHandoff(files);
        if (!handoff.corporateLinkRequestedAt) {
          // One explicit activation request to the authorized FIRST mailbox.
          // An ambiguous request is never repeated automatically.
          writeJsonAtomically(files.handoff, { ...handoff, corporateLinkRequestedAt: new Date().toISOString() });
          await page.getByRole("button", { name: /^Continuar$/i }).filter({ visible: true }).first().click();
          report("corporate activation submitted once; delivery and membership still require proof");
        }
        throw Object.assign(new Error("Corporate EPP activation requires the approved email link; email prepared, no repeated link request."), { exitCode: 79, eppReason: "CORPORATE_ACTIVATION_REQUIRED" });
      }
      if (!codeSubmitted && config.verificationCode && await code.isVisible()) {
        codeSubmitted = true;
        await code.fill(config.verificationCode);
        const submit = page.getByRole("button", { name: /^Continuar$|^Continue$|^Validar$/i }).filter({ visible: true }).first();
        if (await submit.isVisible()) await submit.click();
        else await code.press("Enter");
      }
      await page.waitForTimeout(500);
    } while (Date.now() < deadline);
    if (state.status !== "READY") throw Object.assign(new Error(`EPP access not proven: ${state.reason}.`), { exitCode: state.status === "HUMAN_REQUIRED" ? 79 : 1, eppReason: state.reason });
    await installEppOverlayDismissal(page,config);
    if(state.reason!=='AUTHENTICATED_EPP_HOMEPAGE'){
      const identity = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
      if (identity.state !== "authenticated") throw Object.assign(new Error("EPP registered identity was not proven."), { exitCode: 79, eppReason: "EPP_IDENTITY_REQUIRED" });
    }
    stage = "INDEPENDENT_VERIFY";
    report("EPP storefront observed; independently verifying identity, programme access and UI");
    const captured = await captureEppPageState(context,page,config);
    const verified = await verifyEppSnapshot(config, captured, { expectedEmail: credentials.email });
    if(callbackStatus)verified.proof.callbackStatus=callbackStatus;
    stage = "EXPORT";
    persistVerifiedEppSession(config, verified);
    fs.rmSync(files.handoff, { force: true });
    success = true;
    report("READY · independent EPP verify passed; state exported; closing owned browser");
  } catch (error) {
    if (guard?.lastBlocked()) {
      const denied=guard.lastBlocked();
      report(`navigation denied: ${denied.reason} ${denied.host}${denied.path}`);
      error.eppReason = denied.reason; error.exitCode = 78;
    }
    error.eppStage = error.eppStage || stage;
    if (error.exitCode === 78 || error.eppReason === 'CORPORATE_ACTIVATION_REQUIRED') {
      writeJsonAtomically(files.handoff, { ...readHandoff(files), blockedReason: error.eppReason, blockedAt: new Date().toISOString() });
    }
    throw error;
  } finally {
    try { await guard?.dispose(); }
    finally {
      if (success && browser) try { const cdp = await browser.newBrowserCDPSession(); await cdp.send("Browser.close"); } catch {}
      try { await browser?.close(); }
      finally { lease.release(); }
    }
  }
}

if (require.main === module) refresh(process.argv[2], process.argv[3] || "S2").catch(error => {
  const status = error.exitCode === 79 ? "HUMAN_REQUIRED" : error.exitCode === 78 ? 'BLOCKED' : error.exitCode === 73 || error.code === "AUTH_BUSY" ? "BUSY" : "FAIL";
  const code = typeof error.code === "string" && /^[A-Z_0-9]{1,60}$/.test(error.code) ? error.code : error.name;
  console.error(`[auth:epp] ${status} · ${error.eppStage || "PRECONDITIONS"} · ${error.eppReason || code} · browser preserved when intervention is needed; no raw provider error or credential printed.`);
  process.exitCode = error.exitCode || 1;
});
module.exports = { refresh, observe, isEppPage, needsEppBootstrap, prepareEppCookie, assertEppAuthContinuation, reuseNativeEppSession };
