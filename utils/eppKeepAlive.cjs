const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {getEppConfig} = require('../config/markets/epp');
const sessions = require('./eppSession.cjs');
const {verifyEppSnapshot} = require('./eppSessionVerification.cjs');
const {captureAuthBrowser} = require('./authBrowserLifecycle.cjs');
const {runNodeScript, limitConcurrency} = require('./authKeepAliveRunner.cjs');
const {canonical} = require('./authBundleContent.cjs');
const {writeJsonAtomically} = require('./atomicJson');

const AUTH_INVALID = new Set(['SERVER_IDENTITY_NOT_PROVEN','SERVER_AUTH_REJECTED']);
const EXTERNAL = new Set(['PRODUCTION_NAVIGATION_BLOCKED','UNAPPROVED_NAVIGATION_BLOCKED','VERIFICATION_CODE_REJECTED','CORPORATE_ACTIVATION_REQUIRED','EPP_ENTITLEMENT_NOT_PROVEN','SAMSUNG_ACCOUNT_SECURITY_BLOCKED','COMMERCE_CONTENT_NOT_RENDERED','EPP_COMMERCE_NOT_RENDERED','EPP_SECOND_IDENTITY_NOT_PROVISIONED','EPP_SECOND_IDENTITY_NOT_INDEPENDENT']);
function checkpointPath(config) { return path.join(sessions.getEppSessionPaths(config).directory, 'keepalive.json'); }
function readCheckpoint(config) {
  try { const files=sessions.getEppSessionPaths(config);
    const state=fs.existsSync(checkpointPath(config))?JSON.parse(fs.readFileSync(checkpointPath(config),'utf8')):{};
    if(fs.existsSync(files.handoff)){const handoff=JSON.parse(fs.readFileSync(files.handoff,'utf8'));
      if(handoff.blockedReason&&EXTERNAL.has(handoff.blockedReason))return {...state,blockedReason:handoff.blockedReason,blockerObservedAt:handoff.blockedAt};
      return {...state,human:true};
    }
    return state;
  }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('EPP keep-alive checkpoint is invalid; no refresh authorized.'); }
}
function normalizedSnapshot(snapshot) {
  return {storageState:{...snapshot.storageState,
    cookies:[...snapshot.storageState.cookies].sort((a,b)=>(a.domain+a.path+a.name).localeCompare(b.domain+b.path+b.name)),
    origins:[...snapshot.storageState.origins].sort((a,b)=>a.origin.localeCompare(b.origin))},sessionStorage:snapshot.sessionStorage};
}
function makeBundle(config,snapshot) {
  if (!snapshot.proof?.userAccepted || !snapshot.proof?.accessAccepted) throw new Error('Unproven EPP state cannot replace a bundle.');
  return {schemaVersion:1,store:'EPP',market:config.market,environment:config.environment,authSlot:config.authSlot||'primary',root:config.rootUrl.href,
    snapshot:{...normalizedSnapshot(snapshot),proof:snapshot.proof}};
}
function contentHash(bundle) {return crypto.createHash('sha256').update(JSON.stringify(canonical(bundle))).digest('hex');}
function bundlePath(config) { return path.resolve('playwright/.session-packages/epp',`${config.market.toLowerCase()}-${config.environment.toLowerCase()}-${config.authSlot||'primary'}${config.programNamespace?'-'+config.programNamespace:''}-session-bundle.json`); }
function validateBundle(config,bundle) {
  if (bundle.schemaVersion!==1||bundle.store!=='EPP'||bundle.market!==config.market||bundle.environment!==config.environment||bundle.root!==config.rootUrl.href||bundle.authSlot!==(config.authSlot||'primary')||!bundle.snapshot?.proof?.userAccepted||!bundle.snapshot?.proof?.accessAccepted||!Array.isArray(bundle.snapshot?.storageState?.cookies)||!Array.isArray(bundle.snapshot?.storageState?.origins)||!bundle.snapshot?.sessionStorage||Array.isArray(bundle.snapshot.sessionStorage)) throw new Error('EPP bundle identity/programme mismatch.');
  return {storageState:bundle.snapshot.storageState,sessionStorage:bundle.snapshot.sessionStorage};
}
function packageBundle(config,bundle) {
  validateBundle(config,bundle);
  const file=bundlePath(config);fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,'utf8'));validateBundle(config,old);if(contentHash(old)===contentHash(bundle))return file;}
  writeJsonAtomically(file,bundle);return file;
}
async function verify(config,snapshot) {
  try {
    const proved=await verifyEppSnapshot(config,snapshot,{expectedEmail:sessions.getPrimaryEppCredentials(config).email,timeout:30000});
    return {status:'HEALTHY',snapshot:proved,proof:proved.proof};
  } catch (error) {
    const reason=error.eppReason||'EPP_VERIFY_UNAVAILABLE';
    return {status:AUTH_INVALID.has(reason)?'INVALID':EXTERNAL.has(reason)?'BLOCKED':'UNPROVEN',reason,proof:error.eppProof};
  }
}
async function refresh(config,env,{resumeOnly=false,onHuman=()=>{}}={}) {
  let result,tail='';
  const output=chunk=>{
    tail=(tail+String(chunk)).slice(-12000);
    if (/CAPTCHA\/MFA requires human completion|HUMAN_REQUIRED|SECOND.*QR/i.test(String(chunk))) onHuman();
  };
  const child=await runNodeScript('scripts/auth-epp-maintenance-child.cjs',{...env,[`${config.market}_EPP_AUTH_SLOT`]:config.authSlot||'primary',[`${config.market}_QST_ENVIRONMENT`]:config.environment,[`${config.market}_EPP_PROGRAM`]:config.program,EPP_KEEPALIVE_MARKET:config.market,EPP_KEEPALIVE_ENVIRONMENT:config.environment,EPP_AUTH_SLOT:config.authSlot||'primary',EPP_AUTH_MAINTENANCE:'1',EPP_AUTH_RESUME_ONLY:resumeOnly?'1':'0',EPP_AUTH_INTERACTIVE_TIMEOUT_MS:'600000'}, {timeoutMs:700000,stdout:output,stderr:output});
  const line=tail.split(/\r?\n/).findLast(value=>value.startsWith('EPP_AUTH_RESULT '));
  try { result=JSON.parse(line.slice(16)); } catch { result={status:child.code===79?'HUMAN_REQUIRED':child.code===78?'BLOCKED':'UNPROVEN',reason:'EPP_REFRESH_NOT_PROVEN'}; }
  return result;
}
async function maintainIdentity(config,{allowRefresh=false,publish=false,env=process.env}={},dependencies={}) {
  const d={verify,refresh,load:sessions.loadEppSession,persist:sessions.persistVerifiedEppSession,acquire:sessions.acquireEppLease,read:readCheckpoint,save:(cfg,state)=>writeJsonAtomically(checkpointPath(cfg),state),clearHandoff:cfg=>fs.rmSync(sessions.getEppSessionPaths(cfg).handoff,{force:true}),capture:cfg=>captureAuthBrowser({market:cfg.market.toLowerCase(),environment:cfg.environment,slot:cfg.authSlot||'primary'},{profilesRoot:path.dirname(sessions.getEppSessionPaths(cfg).profile)}),package:packageBundle,publish:require('./eppJenkinsBundle.cjs').publishBundle,...dependencies};
  const base={market:config.market,environment:config.environment,slot:config.authSlot||'primary',store:'EPP',program:config.rootUrl.pathname};
  let lease,owned,checkpoint;
  const finish=(status,reason,extra={})=>({...base,status,...(reason?{reason}:{}),...extra});
  try {
    if(config.programPolicy?.allowAutomaticRetry===false&&['BLOCKED_CALLBACK_TO_PRODUCTION','BLOCKED_EXTERNAL','STORE_FRONT_RENDER_BLOCKED','ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED','VERIFICATION_CODE_REJECTED','PROGRAM_CONTEXT_NOT_PROVEN'].includes(config.programPolicy.knownStatus))return finish('BLOCKED',config.programPolicy.knownStatus,{blockerSource:'PROGRAM_POLICY',loginAttempts:0});
    lease=d.acquire(config,env);checkpoint=d.read(config);
    const runtimeEnv={...env,...lease.env};
    const existing=d.load(config);
    base.session=existing.storageState.cookies.length||existing.storageState.origins.length?'FOUND':'NOT_FOUND';
    let outcome=await d.verify(config,existing),recovered=false,nativeVerified=false;
    if(outcome.status!=='HEALTHY'||checkpoint.human) {
      owned=await d.capture(config);
      const native=await owned?.readEppSnapshot(config.rootUrl.href);
      if(native){const inspected=await d.verify(config,native);if(inspected.status==='HEALTHY'){outcome=inspected;recovered=true;nativeVerified=true;}}
    }
    if(outcome.status==='INVALID'&&!checkpoint.blockedReason) {
      const second=await d.verify(config,existing);
      outcome=second.status==='INVALID'&&second.reason===outcome.reason?second:second.status==='HEALTHY'?second:{status:second.status==='BLOCKED'?'BLOCKED':'UNPROVEN',reason:second.reason||'EPP_VERIFY_DISAGREEMENT'};
    }
    if(outcome.status!=='HEALTHY') {
      if(outcome.status==='BLOCKED') {d.save(config,{...checkpoint,blockedReason:outcome.reason});return finish('BLOCKED',outcome.reason,{proof:outcome.proof});}
      if(checkpoint.blockedReason)return finish('BLOCKED',checkpoint.blockedReason,{proof:outcome.proof,blockerSource:'CHECKPOINT',currentReason:outcome.reason,blockerObservedAt:checkpoint.blockerObservedAt});
      // Resume an audited existing human handoff only; never start a new login
      // because a network/context check was inconclusive.
      if(outcome.status!=='INVALID'&&!(checkpoint.human&&owned&&allowRefresh))return finish(checkpoint.human?'HUMAN_REQUIRED':'UNPROVEN',checkpoint.human?'EPP_HUMAN_PENDING':outcome.reason,{proof:outcome.proof});
      if(!allowRefresh||config.programPolicy?.allowAutomaticRetry===false)return finish(checkpoint.human?'HUMAN_REQUIRED':'BLOCKED',checkpoint.human?'EPP_HUMAN_PENDING':'EPP_AUTH_RECOVERY_REQUIRED',{proof:outcome.proof});
      if(checkpoint.human&&!owned)return finish('HUMAN_REQUIRED','EPP_HANDOFF_BROWSER_MISSING');
      const recovery=await d.refresh(config,runtimeEnv,{resumeOnly:!!checkpoint.human,onHuman:()=>{checkpoint={...checkpoint,human:true};d.save(config,checkpoint);}});
      if(recovery.status!=='REFRESHED') {
        if(recovery.status==='HUMAN_REQUIRED')d.save(config,{...checkpoint,human:true});
        if(recovery.status==='BLOCKED')d.save(config,{...checkpoint,blockedReason:recovery.reason});
        return finish(recovery.status,recovery.reason);
      }
      outcome=await d.verify(config,d.load(config));
      if(outcome.status!=='HEALTHY')return finish(outcome.status==='BLOCKED'?'BLOCKED':'UNPROVEN',outcome.reason);
      recovered=true;
      nativeVerified=true;
    }
    // Verification includes exact programme, server FIRST/SECOND identity and UI.
    d.persist(config,outcome.snapshot);
    const bundle=makeBundle(config,outcome.snapshot),hash=contentHash(bundle);
    const file=await d.package(config,bundle);
    let published=false;
    if(publish&&checkpoint.publishedHash!==hash){try{await d.publish(config,file,env);published=true;}catch{return finish('PUBLISH_FAILED','EPP_BUNDLE_PUBLISH_FAILED');}}
    const humanPending=!!(checkpoint.human&&owned&&!nativeVerified);
    if(!humanPending)d.clearHandoff(config);
    d.save(config,{...checkpoint,human:humanPending,blockedReason:null,contentHash:hash,...(published?{publishedHash:hash}:{})});
    // Only an exact owned EPP browser, after independent proof and publication.
    if(owned&&nativeVerified)await owned.closeVerified();
    return finish(recovered?'REFRESHED':'KEEP_ALIVE_OK',null,{action:recovered?'REFRESHED':'SESSION_REUSED',proof:outcome.proof,bundleChanged:checkpoint.contentHash!==hash,published,...(humanPending?{humanPending:true}:{})});
  } catch(error) { return finish(error.code==='AUTH_BUSY'?'BUSY':'UNPROVEN',error.code==='AUTH_BUSY'?'EPP_IDENTITY_BUSY':error.code==='EPP_NATIVE_SNAPSHOT_TIMEOUT'?error.code:'EPP_MAINTENANCE_UNPROVEN'); }
  finally {await owned?.dispose();lease?.release();}
}
async function runCycle({environment='S2',markets=['MX','PE','CO','CL'],slot='primary',...options}={},dependencies={}) {
  const lane=limitConcurrency(options.allowRefresh?1:2),results=[];let humanPending=false;
  await Promise.all(markets.map(market=>lane(async()=>{
    try {const config=getEppConfig(market,{...options.env,ENVIRONMENT:environment,EPP_AUTH_SLOT:slot});
      const result=await maintainIdentity(config,humanPending?{...options,allowRefresh:false}:options,dependencies);
      if(humanPending&&result.reason==='EPP_AUTH_RECOVERY_REQUIRED')result.reason='EPP_INTERACTIVE_GATE_PENDING';
      results.push(result);if(result.status==='HUMAN_REQUIRED')humanPending=true;
    } catch {results.push({market,environment,slot,store:'EPP',status:'BLOCKED',reason:'UNSUPPORTED_EPP_IDENTITY'});}
  })));
  return {environment,store:'EPP',identities:results,ok:results.every(r=>['KEEP_ALIVE_OK','REFRESHED'].includes(r.status))};
}
module.exports={AUTH_INVALID,EXTERNAL,makeBundle,validateBundle,contentHash,packageBundle,bundlePath,readCheckpoint,verify,refresh,maintainIdentity,runCycle};
