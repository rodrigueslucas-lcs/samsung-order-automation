const { chromium } = require("@playwright/test");
const { installEppSessionStorage, captureEppPageState } = require("./eppSession.cjs");
const { proveEppAccess } = require("./eppAccessState.cjs");
const { watchEppServerProof } = require("./eppServerProof.cjs");
const { openAuthProfile } = require("./authStorefrontReady.cjs");
const { installEppNavigationGuard } = require('./eppNavigationGuard.cjs');
const {installEppOverlayDismissal,dismissEppNotificationTutorial}=require('./eppStorefrontOverlays.cjs');

async function terminateOwnedVerifier(server,timeout=5000){
  const child=server.process?.();
  if(!child||typeof child.once!=='function'||typeof child.kill!=='function')return server.kill();
  const exited=()=>child.exitCode!=null||child.signalCode!=null;
  if(exited())return;
  let timer,onExit;
  try{await new Promise((resolve,reject)=>{
    onExit=resolve;child.once('exit',onExit);
    timer=setTimeout(()=>reject(Object.assign(new Error('Owned verifier process did not exit.'),{eppReason:'EPP_VERIFIER_CLEANUP_TIMEOUT'})),timeout);
    // This is the exact isolated headless process created by launchServer,
    // never a native profile, PID scan, process tree or operator browser.
    if(!child.kill('SIGKILL')&&!exited())reject(Object.assign(new Error('Owned verifier could not be stopped.'),{eppReason:'EPP_VERIFIER_CLEANUP_TIMEOUT'}));
    else if(exited())resolve();
  });}finally{clearTimeout(timer);child.removeListener('exit',onExit);}
}

async function recoverEppParkingReturn(page,config){
  const current=new URL(page.url()),root=new URL(config.rootUrl);
  if(root.protocol!=='https:'||!['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(root.hostname)||current.origin!==root.origin||!/^\/onlinestore\/(?:uk|mx|pe|co|cl)\/SystemParking\.html$/i.test(current.pathname))return false;
  // Caller retains the Production navigation guard. Never replay Account.
  await page.goto(new URL('/getcookie.html',root).href,{waitUntil:'commit',timeout:30000});
  await page.getByText(/You can access pages now/i).filter({visible:true}).first().waitFor({timeout:15000});
  await page.goto(root.href,{waitUntil:'commit',timeout:60000});
  return true;
}

async function verifyEppSnapshot(config, snapshot, { expectedEmail, timeout = 60000, configureContext = async () => {}, overallTimeoutMs=Math.max(timeout*3+15000,45000), cleanupTimeoutMs=15000 } = {}) {
  if(![overallTimeoutMs,cleanupTimeoutMs].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid EPP verification deadline.');
  // Own the verifier's process explicitly so a stalled CDP disconnect cannot
  // retain the market lease or be mistaken for rejected authentication.
  const server = await chromium.launchServer({ channel: "chrome", headless: true });
  let browser, guard, proof, page, ui, timer, failure, stage='CONTEXT';
  try {
    browser=await chromium.connect(server.wsEndpoint(),{timeout:15000});
    const operation=(async()=>{
    const context = await browser.newContext({ storageState: snapshot.storageState });
    guard = await installEppNavigationGuard(context,config);
    await installEppSessionStorage(context, config, snapshot.sessionStorage);
    await configureContext(context);
    proof = watchEppServerProof(context, config, { expectedEmail });
    page = await context.newPage();
    await guard.protectPage(page);
    await installEppOverlayDismissal(page,config);
    // A fresh Chromium context still needs the staging routing cookie even
    // when it already contains a valid Samsung/EPP identity snapshot.
    stage='STAGING_SETUP_NAVIGATION';
    await page.goto(new URL('/getcookie.html', config.rootUrl).href, { waitUntil: 'commit', timeout });
    stage='STAGING_SETUP_READY';
    await page.getByText(/You can access pages now/i).first().waitFor({ timeout: Math.min(timeout,15000) });
    stage='PROGRAM_NAVIGATION';
    await page.goto(config.rootUrl.href, { waitUntil: "commit", timeout });
    stage='PROGRAM_PROOF';
    const deadline = Date.now() + timeout;
    do {
      await dismissEppNotificationTutorial(page,config);
      ui = await proveEppAccess(page, config);
      await proof.settle();
      // A definitive programme gate is not a rejected Samsung credential.
      // Repeating login cannot activate a corporate programme or fix its code.
      if(['CORPORATE_ACTIVATION_REQUIRED','VERIFICATION_CODE_REJECTED'].includes(ui.reason)) {
        throw Object.assign(new Error('EPP programme prerequisite requires external resolution.'),{
          exitCode:78,eppReason:ui.reason,eppProof:proof.snapshot(),
        });
      }
      if (ui.status === "READY" && proof.accepted()) break;
      await page.waitForTimeout(250);
    } while (Date.now() < deadline);
    if (ui.status !== "READY" || !proof.accepted()) {
      const server = proof.snapshot();
      const human = server.reason === "SERVER_AUTH_REJECTED" || server.reason === "SERVER_IDENTITY_NOT_PROVEN" || server.reason === "EPP_ENTITLEMENT_NOT_PROVEN";
      throw Object.assign(new Error("EPP independent verification did not prove authenticated access."), { exitCode: human ? 79 : 1, eppReason: server.reason === "SERVER_PROOF_PENDING" ? ui.reason : server.reason, eppProof: server });
    }
    // Some independently entitled programmes render a welcome landing without
    // an account menu. Server identity + programme access + that exact UI are
    // sufficient for session health; official logout TCs still prove logout.
    stage='PROFILE_PROOF';
    if(!(ui.reason==='AUTHENTICATED_EPP_HOMEPAGE'&&proof.accepted())){
      const profile = await openAuthProfile(page, { market: config.market.toLowerCase(), prepareWindow: async () => {} });
      if (profile.state !== "authenticated") throw Object.assign(new Error("EPP logout proof missing."), { exitCode: 79, eppReason: "EPP_IDENTITY_REQUIRED" });
    }
    // Capture AFTER verification, including cookies/storage renewed by it.
    stage='CAPTURE';
    const result = {...await captureEppPageState(context,page,config),proof: {...proof.snapshot(),storefrontAccepted:true}};
    proof.stop();
    return result;
    })();
    return await Promise.race([operation,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Object.assign(new Error('EPP verifier exceeded its total deadline.'),{eppReason:'EPP_VERIFICATION_DEADLINE',code:'EPP_VERIFICATION_DEADLINE'})),overallTimeoutMs);
    })]);
  } catch (error) {
    failure=error;
    error.eppStage=stage;
    error.eppProof=error.eppProof||proof?.snapshot();
    error.eppUi=ui;
    if(page&&!page.isClosed())error.eppFinalPath=new URL(page.url()).pathname;
    if (guard?.lastBlocked()) Object.assign(error,{exitCode:78,eppReason:guard.lastBlocked().reason});
    else if (error.name === 'TimeoutError' && !error.eppReason) {
      // A menu timeout must not hide a completed, exact-programme anonymous
      // response. Pending/network proof still cannot authorize another login.
      const server=error.eppProof;
      if(stage==='PROGRAM_PROOF'&&server?.accessAccepted&&['SERVER_AUTH_REJECTED','SERVER_IDENTITY_NOT_PROVEN'].includes(server.reason)){
        error.eppReason=server.reason;error.exitCode=79;
      }else error.eppReason='EPP_NAVIGATION_OR_RENDER_TIMEOUT';
    }
    throw error;
  } finally {
    clearTimeout(timer);
    proof?.stop();
    // A stuck CDP cleanup must not keep the regional lease forever. These
    // handles belong to this isolated verifier, never the operator's browser.
    for(const [index,close] of [()=>guard?.dispose(),()=>terminateOwnedVerifier(server,Math.min(cleanupTimeoutMs,5000))].entries()){
      let deadline;
      try{await Promise.race([Promise.resolve().then(close),new Promise((_,reject)=>{
        deadline=setTimeout(()=>reject(Object.assign(new Error('EPP verifier cleanup exceeded its deadline.'),{eppReason:'EPP_VERIFIER_CLEANUP_TIMEOUT'})),cleanupTimeoutMs);
      })]);}catch(error){if(index===1&&!failure)failure=error;}
      finally{clearTimeout(deadline);}
    }
    if(failure?.eppReason==='EPP_VERIFIER_CLEANUP_TIMEOUT')throw failure;
  }
}

module.exports = { verifyEppSnapshot, recoverEppParkingReturn, terminateOwnedVerifier };
