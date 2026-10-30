const {chromium}=require('@playwright/test');
const {installEppNavigationGuard}=require('./eppNavigationGuard.cjs');
const {watchEppServerProof}=require('./eppServerProof.cjs');
const {proveEppAccess}=require('./eppAccessState.cjs');
const {installEppSessionStorage,captureEppPageState}=require('./eppSession.cjs');

function classifyProgramObservation(config,{proof={},ui={},blocked=null,bodyLength=0,callbackStatus=null}={}){
  const identity=proof.userAccepted===true?'AUTHENTICATED':'UNKNOWN';
  const entitlement=proof.accessAccepted===true?'VALID':'UNKNOWN';
  const storefront=ui.status==='READY'?'OK':bodyLength===0?'EMPTY':'BLOCKED';
  const healthy=identity==='AUTHENTICATED'&&entitlement==='VALID'&&storefront==='OK'&&!blocked;
  const reason=blocked?.reason||(healthy?null:bodyLength===0?'ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED':proof.userAccepted&&proof.accessAccepted?(ui.reason||'COMMERCE_CONTENT_NOT_RENDERED'):(proof.reason==='SERVER_PROOF_PENDING'?ui.reason:proof.reason)||ui.reason||'AUTH_OR_ENTITLEMENT_REQUIRED');
  return {store:'EPP',market:config.market,environment:config.environment,program:config.program,root:config.rootUrl.href,slot:config.authSlot||'primary',identity,entitlement,storefront,health:healthy?'HEALTHY':'BLOCKED',reason,callbackStatus,action:healthy?(callbackStatus==='BROKEN_400'?'RECOVER_CANONICAL_URL':'REUSE'):'INSPECT_ONLY',retries:0,loginAttempts:0,financialSubmits:0};
}

// A bounded read-only probe. No login, gate/code/email submission or cart action.
async function inspectProgram(config,snapshot,{expectedEmail,timeout=20000}={}){
  const browser=await chromium.launch({channel:'chrome',headless:true});let guard,server;
  const diagnostics={http:[],consoleErrors:0,networkFailures:0,bodyLength:0};
  try{
    const context=await browser.newContext({storageState:snapshot.storageState});
    guard=await installEppNavigationGuard(context,config);
    await installEppSessionStorage(context,config,snapshot.sessionStorage);
    server=watchEppServerProof(context,config,{expectedEmail});
    const page=await context.newPage();await guard.protectPage(page);
    page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors++;});
    page.on('requestfailed',()=>{diagnostics.networkFailures++;});
    context.on('response',r=>{const u=new URL(r.url());if(u.origin===config.rootUrl.origin||u.hostname===`${config.environment==='S1'?'s1':'s2'}-smb-api-cdn.ecom-stg.samsung.com`){if(r.request().isNavigationRequest()||/\/users\/current(?:\/checkAccess)?\/?$/.test(u.pathname))diagnostics.http.push({path:u.pathname,status:r.status(),method:r.request().method()});}});
    {
      await page.goto(new URL('/getcookie.html',config.rootUrl).href,{waitUntil:'commit',timeout});
      await page.getByText(/You can access pages now/i).first().waitFor({timeout:Math.min(timeout,10000)});
    }
    await page.goto(config.rootUrl.href,{waitUntil:'domcontentloaded',timeout});
    const end=Date.now()+timeout;let ui={};
    do{ui=await proveEppAccess(page,config);await server.settle();if((ui.status==='READY'&&server.accepted())||guard.lastBlocked()||['VERIFICATION_CODE_REJECTED','CORPORATE_ACTIVATION_REQUIRED'].includes(ui.reason))break;await page.waitForTimeout(400);}while(Date.now()<end);
    diagnostics.bodyLength=await page.locator('body').innerText({timeout:3000}).then(t=>t.trim().length).catch(()=>0);
    const row=classifyProgramObservation(config,{proof:server.snapshot(),ui,blocked:guard.lastBlocked(),bodyLength:diagnostics.bodyLength});
    if(!server.accepted()&&diagnostics.http.some(r=>r.path===`/tokocommercewebservices/v2/${config.market.toLowerCase()}/users/current`))row.reason='PROGRAM_CONTEXT_NOT_PROVEN';
    const result={...row,proof:server.snapshot(),diagnostics,observedAt:new Date().toISOString()};
    if(row.health==='HEALTHY')result.snapshot={...await captureEppPageState(context,page,config),proof:{...server.snapshot(),storefrontAccepted:true}};
    return result;
  }catch(error){return {...classifyProgramObservation(config,{proof:server?.snapshot(),blocked:guard?.lastBlocked(),bodyLength:diagnostics.bodyLength}),reason:guard?.lastBlocked()?.reason||(error.name==='TimeoutError'?'EPP_NAVIGATION_OR_RENDER_TIMEOUT':'EPP_INSPECTION_UNPROVEN'),diagnostics,observedAt:new Date().toISOString()};}
  finally{server?.stop();try{await guard?.dispose();}finally{await browser.close();}}
}
module.exports={classifyProgramObservation,inspectProgram};
