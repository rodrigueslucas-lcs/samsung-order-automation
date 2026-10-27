const { chromium } = require("@playwright/test");
const { installEppSessionStorage } = require("./eppSession.cjs");
const { proveEppAccess } = require("./eppAccessState.cjs");
const { watchEppServerProof } = require("./eppServerProof.cjs");
const { openAuthProfile } = require("./authStorefrontReady.cjs");
const { installEppNavigationGuard } = require('./eppNavigationGuard.cjs');
const {installEppOverlayDismissal,dismissEppNotificationTutorial}=require('./eppStorefrontOverlays.cjs');

async function verifyEppSnapshot(config, snapshot, { expectedEmail, timeout = 60000, configureContext = async () => {} } = {}) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let guard, proof;
  try {
    const context = await browser.newContext({ storageState: snapshot.storageState });
    guard = await installEppNavigationGuard(context,config);
    await installEppSessionStorage(context, config, snapshot.sessionStorage);
    await configureContext(context);
    proof = watchEppServerProof(context, config, { expectedEmail });
    const page = await context.newPage();
    await guard.protectPage(page);
    await installEppOverlayDismissal(page,config);
    await page.goto(config.rootUrl.href, { waitUntil: "commit", timeout });
    const deadline = Date.now() + timeout;
    let ui;
    do {
      await dismissEppNotificationTutorial(page,config);
      ui = await proveEppAccess(page, config);
      await proof.settle();
      if (ui.status === "READY" && proof.accepted()) break;
      await page.waitForTimeout(250);
    } while (Date.now() < deadline);
    if (ui.status !== "READY" || !proof.accepted()) {
      const server = proof.snapshot();
      const human = server.reason === "SERVER_AUTH_REJECTED" || server.reason === "SERVER_IDENTITY_NOT_PROVEN" || server.reason === "EPP_ENTITLEMENT_NOT_PROVEN";
      throw Object.assign(new Error("EPP independent verification did not prove authenticated access."), { exitCode: human ? 79 : 1, eppReason: server.reason === "SERVER_PROOF_PENDING" ? ui.reason : server.reason });
    }
    const profile = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
    if (profile.state !== "authenticated") throw Object.assign(new Error("EPP logout proof missing."), { exitCode: 79, eppReason: "EPP_IDENTITY_REQUIRED" });
    // Capture AFTER verification, including cookies/storage renewed by it.
    const result = {
      storageState: await context.storageState(),
      sessionStorage: await page.evaluate(() => Object.fromEntries(Object.entries(globalThis.sessionStorage))),
      proof: proof.snapshot(),
    };
    proof.stop();
    return result;
  } catch (error) {
    if (guard?.lastBlocked()) Object.assign(error,{exitCode:78,eppReason:guard.lastBlocked().reason});
    else if (error.name === 'TimeoutError' && !error.eppReason) error.eppReason='EPP_NAVIGATION_OR_RENDER_TIMEOUT';
    throw error;
  } finally {
    proof?.stop();
    try { await guard?.dispose(); }
    finally { await browser.close(); }
  }
}

module.exports = { verifyEppSnapshot };
