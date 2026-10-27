const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { getEppConfig } = require("../config/markets/epp");
const { getEppSessionPaths, getPrimaryEppCredentials, persistVerifiedEppSession, acquireEppLease, eppLoginResumeOptions } = require("../utils/eppSession.cjs");
const { verifyEppSnapshot } = require("../utils/eppSessionVerification.cjs");
const { connectAuthBrowser } = require("../utils/authDedicatedBrowser.cjs");
const { prepareAuthBrowserWindow } = require("../utils/authBrowserWindow.cjs");
const { authProfileControl, openAuthProfile } = require("../utils/authStorefrontReady.cjs");
const { completeAccountLogin, discardRejectedAccountPages } = require("../utils/authAccountLogin.cjs");
const { writeJsonAtomically } = require("../utils/atomicJson");
const { proveEppAccess: observe, findEppVerifiedContinue, eppAccountLoginAction } = require("../utils/eppAccessState.cjs");

function isEppPage(page, config) {
  try { const url = new URL(page.url()); return !page.isClosed() && url.origin === config.rootUrl.origin && url.pathname.startsWith(config.rootUrl.pathname); }
  catch { return false; }
}

function readHandoff(files) {
  if (!fs.existsSync(files.handoff)) return {};
  try { return JSON.parse(fs.readFileSync(files.handoff, "utf8")); }
  catch { throw Object.assign(new Error("EPP handoff ownership/state requires manual review."), { exitCode: 79, eppReason: "HANDOFF_STATE_UNKNOWN" }); }
}

async function refresh(market, environment) {
  const config = getEppConfig(market, { ENVIRONMENT: environment });
  const files = getEppSessionPaths(config);
  const credentials = getPrimaryEppCredentials(config);
  const lease = acquireEppLease(config);
  fs.mkdirSync(files.directory, { recursive: true });
  let browser, success = false, startedNewAccountFlow = false, stage = "CONNECT_BROWSER";
  const report = message => console.log(`[auth:epp] ${config.market} ${config.environment} FIRST · ${message}`);
  try {
    report("START · isolated EPP profile; no Base Store state imported");
    browser = await connectAuthBrowser({ chromium, profileDir: files.profile, market: config.market.toLowerCase(), environment: config.environment }, {
      log: () => {},
      launch: () => {
        const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe")].find(file => fs.existsSync(file));
        if (!chrome) throw new Error("Chrome executable is unavailable.");
        const child = spawn(chrome, [`--user-data-dir=${files.profile}`, "--remote-debugging-port=0", "--disable-background-mode", "--start-maximized", "--no-first-run", "--no-default-browser-check", "--hide-crash-restore-bubble", "--new-window", "about:blank"], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
        return { status: 0 };
      },
    });
    const context = browser.contexts()[0];
    await discardRejectedAccountPages(context);
    let page = context.pages().find(candidate => { try { return new URL(candidate.url()).hostname === "account.samsung.com"; } catch { return false; } });
    if (!page) {
      stage = "STAGING_BOOTSTRAP";
      page = context.pages().find(candidate => isEppPage(candidate, config)) || context.pages()[0] || await context.newPage();
      await prepareAuthBrowserWindow(page);
      // Resume an owned registration/verification dialog in place. Navigation
      // would discard its successful code confirmation and could repeat work.
      if (!isEppPage(page, config)) {
        await page.goto(new URL("/getcookie.html", config.rootUrl).href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.getByText(/You can access pages now/i).first().waitFor({ timeout: 15000 });
        await page.goto(config.rootUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      } else if (new URL(page.url()).pathname !== config.rootUrl.pathname && !/\/auth\/multistore\/?$|\/registration\/?$/.test(new URL(page.url()).pathname)) {
        // Auth is proven on the EPP home, independently of a particular SKU.
        // Resume verification dialogs in place; never lose their positive result.
        await page.goto(config.rootUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      } else if (config.accessMode === "corporate-email-link" && readHandoff(files).corporateLinkRequestedAt) {
        await page.goto(config.rootUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
      const login = eppAccountLoginAction(page);
      await Promise.any([login.waitFor({ timeout: 60000 }), page.locator('input[type="email"]:visible').first().waitFor({ timeout: 60000 }), page.getByRole("textbox", { name: /c[oó]digo|verification/i }).first().waitFor({ timeout: 60000 }), authProfileControl(page).waitFor({ state: "visible", timeout: 60000 })]).catch(() => {});
      let loginAction = await login.isVisible() ? login : null;
      if (!loginAction && await authProfileControl(page).isVisible()) {
        const profile = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
        if (profile.state === "signed-out") loginAction = profile.login;
      }
      if (loginAction) {
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
      if (handoff.passwordAttempted && await page.locator('input[type="password"]:visible').count()) throw Object.assign(new Error("Previous password outcome requires manual review; no repeat submit."), { exitCode: 79 });
      await prepareAuthBrowserWindow(page);
      report("Samsung Account opened; automatic FIRST credentials, human CAPTCHA/MFA only");
      await completeAccountLogin(page, { market: config.market.toLowerCase(), hostname: config.rootUrl.hostname, credentials,
        timeout: 600000, ...eppLoginResumeOptions(handoff, startedNewAccountFlow),
        log: message => {
          if (message.startsWith("AUTH_HANDOFF_AUDIT ")) {
            try { writeJsonAtomically(files.handoff, { ...readHandoff(files), ...JSON.parse(message.slice("AUTH_HANDOFF_AUDIT ".length)) }); } catch {}
          } else report(message.replace(/^\[auth:login:[^\]]+\]\s*/, ""));
        } });
    }
    stage = "EPP_ACCESS";
    page = context.pages().find(candidate => isEppPage(candidate, config)) || context.pages().find(candidate => { try { return new URL(candidate.url()).origin === config.rootUrl.origin; } catch { return false; } }) || page;
    if (!isEppPage(page, config)) await page.goto(config.rootUrl.href, { waitUntil: "domcontentloaded", timeout: 60000 });
    const email = page.locator('input[type="email"]:visible').first();
    const code = page.getByRole("textbox", { name: /verification|access code|c[oó]digo|clave de acceso/i }).or(page.getByPlaceholder(/verification|access code|c[oó]digo|clave de acceso/i)).filter({ visible: true }).first();
    const deadline = Date.now() + 60000;
    let state, codeSubmitted = false, confirmationAttempted = false;
    do {
      const gate = await observe(page, config);
      if (gate.reason === 'VERIFICATION_CODE_REJECTED') throw Object.assign(new Error('Configured EPP code rejected; no repeat submit.'), { exitCode: 78, eppReason: gate.reason });
      const confirmation = confirmationAttempted ? null : await findEppVerifiedContinue(page);
      if (confirmation) {
        confirmationAttempted = true;
        codeSubmitted = true;
        report("EPP code accepted; continuing the verified-account dialog once");
        await confirmation.click();
      }
      state = await observe(page, config);
      if (state.status === "READY") break;
      if (state.reason === "CORPORATE_ACTIVATION_REQUIRED") {
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
    const identity = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
    if (identity.state !== "authenticated") throw Object.assign(new Error("EPP registered identity was not proven."), { exitCode: 79, eppReason: "EPP_IDENTITY_REQUIRED" });
    stage = "INDEPENDENT_VERIFY";
    report("EPP access and authenticated logout proven; verifying an independent context");
    const storageState = await context.storageState();
    const sessionStorage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    const verified = await verifyEppSnapshot(config, { storageState, sessionStorage }, { expectedEmail: credentials.email });
    stage = "EXPORT";
    persistVerifiedEppSession(config, verified);
    fs.rmSync(files.handoff, { force: true });
    success = true;
    report("READY · independent EPP verify passed; state exported; closing owned browser");
  } catch (error) {
    error.eppStage = stage;
    throw error;
  } finally {
    if (success && browser) try { const cdp = await browser.newBrowserCDPSession(); await cdp.send("Browser.close"); } catch {}
    await browser?.close().catch(() => {});
    lease.release();
  }
}

if (require.main === module) refresh(process.argv[2], process.argv[3] || "S2").catch(error => {
  const status = error.exitCode === 79 ? "HUMAN_REQUIRED" : error.exitCode === 78 ? 'BLOCKED' : error.exitCode === 73 || error.code === "AUTH_BUSY" ? "BUSY" : "FAIL";
  const code = typeof error.code === "string" && /^[A-Z_0-9]{1,60}$/.test(error.code) ? error.code : error.name;
  console.error(`[auth:epp] ${status} · ${error.eppStage || "PRECONDITIONS"} · ${error.eppReason || code} · browser preserved when intervention is needed; no raw provider error or credential printed.`);
  process.exitCode = error.exitCode || 1;
});
module.exports = { refresh, observe, isEppPage };
