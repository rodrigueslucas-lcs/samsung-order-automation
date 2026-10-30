const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { writeJsonAtomically } = require("./atomicJson");
const leaseModule = require("./authMarketLease.cjs");

function getEppSessionPaths(config) {
  const { market, environment } = config;
  if (!["MX", "CO", "PE", "CL"].includes(market) || !["S1", "S2"].includes(environment)) throw new Error("Invalid EPP identity.");
  const slot = config.authSlot || 'primary';
  const program=config.programNamespace;
  if(program&&!/^[a-z][a-z0-9_]{1,60}$/.test(program))throw new Error('Invalid EPP programme namespace.');
  if (!['primary', 'second'].includes(slot) || (slot === 'second' && !['MX', 'CO'].includes(market))) throw new Error('Invalid EPP account slot.');
  const directory = path.join(root, "playwright", ".auth", "epp", environment.toLowerCase(), market.toLowerCase(), ...(program?['programs',program]:[]), ...(slot === 'second' ? ['second'] : []));
  return {
    directory,
    profile: path.join(root, "playwright", "profiles", "epp", ...(program?['programs',program]:[]), `${environment.toLowerCase()}-${market.toLowerCase()}-${slot === 'second' ? 'second' : 'qa'}`),
    state: path.join(directory, "state.json"), session: path.join(directory, "session-storage.json"),
    metadata: path.join(directory, "identity.json"), handoff: path.join(directory, "handoff.json"), lock: path.join(directory, "refresh.lock"),
  };
}

// Lucas explicitly authorized the configured FIRST credential for isolated EPP.
// Only credentials are shared; no Base Store state/profile/bundle is loaded.
function getPrimaryEppCredentials(config, environment = process.env, io = fs) {
  if (config.authSlot === 'second') {
    const file = environment[`${config.market}_EPP_SECOND_CREDENTIAL_FILE`] || path.join(root, 'playwright', '.auth', `${config.market.toLowerCase()}-second-storefront-user.json`);
    let second;
    try { second = JSON.parse(io.readFileSync(file, 'utf8')); } catch { throw Object.assign(new Error('EPP SECOND identity is not provisioned; FIRST fallback is forbidden.'),{eppReason:'EPP_SECOND_IDENTITY_NOT_PROVISIONED'}); }
    const email = environment[`${config.market}_EPP_SECOND_EMAIL`] || second.email;
    if (typeof email !== 'string' || !email.trim()) throw Object.assign(new Error('EPP SECOND identity is not provisioned.'),{eppReason:'EPP_SECOND_IDENTITY_NOT_PROVISIONED'});
    const first=getPrimaryEppCredentials({...config,authSlot:'primary'},environment,io);
    if(email.trim().toLowerCase()===first.email.trim().toLowerCase())throw Object.assign(new Error('EPP SECOND must differ from FIRST.'),{eppReason:'EPP_SECOND_IDENTITY_NOT_INDEPENDENT'});
    return { email: email.trim(), password: null };
  }
  const explicit = environment[`${config.market}_EPP_CREDENTIAL_FILE`];
  const candidates = explicit ? [path.resolve(explicit)] : ["samsung-storefront-user.json", "mx-storefront-user.json", "co-storefront-user.json", "pe-storefront-user.json", "cl-storefront-user.json"].map(name => path.join(root, "playwright", ".auth", name));
  let local = {};
  for (const file of candidates) if (io.existsSync(file)) {
    try { local = JSON.parse(io.readFileSync(file, "utf8")); } catch { throw new Error("EPP FIRST credential file is invalid; contents suppressed."); }
    if (local.email && local.password) break;
  }
  const email = environment.EPP_SAMSUNG_EMAIL || environment.SAMSUNG_ACCOUNT_EMAIL || local.email;
  const password = environment.EPP_SAMSUNG_PASSWORD || environment.SAMSUNG_ACCOUNT_PASSWORD || local.password;
  if (!email || !password) throw new Error("EPP FIRST credentials are not configured.");
  return { email, password };
}

function loadEppSession(config, io = fs) {
  const files = getEppSessionPaths(config);
  if (!io.existsSync(files.metadata)) return { storageState: { cookies: [], origins: [] }, sessionStorage: {} };
  try {
    const identity = JSON.parse(io.readFileSync(files.metadata, "utf8"));
    if (identity.store !== "EPP" || identity.market !== config.market || identity.environment !== config.environment || identity.root !== config.rootUrl.href || (identity.authSlot || 'primary') !== (config.authSlot || 'primary') || identity.verified !== true) throw new Error();
    const storageState = JSON.parse(io.readFileSync(files.state, "utf8"));
    const sessionStorage = JSON.parse(io.readFileSync(files.session, "utf8"));
    if (!Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins) || !sessionStorage || Array.isArray(sessionStorage) || typeof sessionStorage !== "object") throw new Error();
    return { storageState, sessionStorage };
  } catch { throw new Error("EPP state is invalid or belongs to another multistore; no Base Store fallback is allowed."); }
}

async function installEppSessionStorage(context, config, values) {
  await context.addInitScript(({ origin, prefix, values }) => {
    if (location.origin === origin && location.pathname.startsWith(prefix)) {
      for (const [key, value] of Object.entries(values)) if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, String(value));
    }
  }, { origin: config.rootUrl.origin, prefix: config.rootUrl.pathname, values });
}

async function captureEppPageState(context,page,config,{timeoutMs=15000}={}){
  const root=new URL(config.rootUrl),current=new URL(page.url());
  if(root.protocol!=='https:'||!['stg.shop.samsung.com','stg2.shop.samsung.com'].includes(root.hostname)||current.origin!==root.origin||!current.pathname.startsWith(root.pathname))throw new Error('EPP capture must remain in its exact staging programme.');
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Invalid EPP snapshot deadline.');
  let timer;
  try{return await Promise.race([(async()=>{
    const [cookies,storage]=await Promise.all([context.cookies(),page.evaluate(()=>({
      localStorage:Object.entries(localStorage).map(([name,value])=>({name,value})),
      sessionStorage:Object.fromEntries(Object.entries(sessionStorage)),
    }))]);
    return{storageState:{cookies,origins:[{origin:root.origin,localStorage:storage.localStorage}]},sessionStorage:storage.sessionStorage};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('EPP snapshot capture did not finish.'),{code:'EPP_SNAPSHOT_TIMEOUT',eppReason:'EPP_SNAPSHOT_TIMEOUT'})),timeoutMs);})]);}finally{clearTimeout(timer);}
}

function loadEppProgramSeed(config,{load=loadEppSession}={}){
  const own=load(config);
  if(own.storageState.cookies.length||own.storageState.origins.length)return {snapshot:own,sourceProgram:config.program};
  const {getEppPrograms,getEppConfig}=require('../config/markets/epp');
  for(const program of getEppPrograms(config.market,config.environment)){
    if(program.id===config.program)continue;
    const sibling=getEppConfig(config.market,{ENVIRONMENT:config.environment,EPP_PROGRAM:program.id,EPP_AUTH_SLOT:config.authSlot||'primary'});
    try{const candidate=load(sibling);if(candidate.storageState.cookies.length||candidate.storageState.origins.length)return {snapshot:candidate,sourceProgram:program.id};}catch{/* Unproven sibling state is not a seed. */}
  }
  return {snapshot:own,sourceProgram:null};
}

function persistVerifiedEppSession(config, snapshot, { io = fs, write = writeJsonAtomically, now = () => new Date().toISOString() } = {}) {
  if (!snapshot.proof?.userAccepted || !snapshot.proof?.accessAccepted) throw new Error("Unverified EPP state must not be exported.");
  const files = getEppSessionPaths(config);
  io.mkdirSync(files.directory, { recursive: true });
  write(files.state, snapshot.storageState);
  write(files.session, snapshot.sessionStorage);
  write(files.metadata, { store: "EPP", market: config.market, environment: config.environment, authSlot: config.authSlot || 'primary', root: config.rootUrl.href, verified: true, serverAccepted: true, verifiedAt: now(),...(snapshot.proof.callbackStatus==='BROKEN_400'?{callbackStatus:'BROKEN_400'}:{}) });
  if(snapshot.proof.storefrontAccepted===true)write(path.join(files.directory,'program-observation.json'),{store:'EPP',market:config.market,environment:config.environment,program:config.program,root:config.rootUrl.href,slot:config.authSlot||'primary',observedAt:now(),proof:{userAccepted:true,accessAccepted:true},identity:'AUTHENTICATED',entitlement:'VALID',storefront:'OK',health:'HEALTHY',reason:null,callbackStatus:snapshot.proof.callbackStatus==='BROKEN_400'?'BROKEN_400':null,action:'VERIFIED',retries:0});
}

function acquireEppLease(config, environment = process.env, { io = fs, acquire = leaseModule.acquireMarketLease, register = leaseModule.registerLeaseProcess } = {}) {
  const files = getEppSessionPaths(config);
  // Preserve any still-running pre-migration EPP worker. Never compete with it.
  if (io.existsSync(files.lock)) throw Object.assign(new Error("EPP profile has an existing refresh owner."), { code: "AUTH_BUSY", exitCode: 73 });
  const directory = path.join(root, "playwright", ".auth", "epp", ".leases");
  const release = acquire(config.market.toLowerCase(), config.environment, { directory, env: { AUTH_MARKET_LEASE: environment.EPP_LEASE_TOKEN } });
  const unregister = register(release.env);
  return { env: { ...release.env, EPP_LEASE_TOKEN: release.env.AUTH_MARKET_LEASE }, release: () => { unregister(); release(); } };
}

function eppLoginResumeOptions(handoff = {}, startedNewFlow = false) {
  const phase = startedNewFlow ? 'NONE' : handoff.emailPhase || 'NONE';
  if (!['NONE','READY','CHALLENGE'].includes(phase)) throw new Error('Unknown EPP email handoff phase.');
  return { resumeOnly: !startedNewFlow && phase !== 'NONE', resumeEmailPhase: phase };
}

module.exports = { getEppSessionPaths, getPrimaryEppCredentials, loadEppSession, loadEppProgramSeed, installEppSessionStorage, captureEppPageState, persistVerifiedEppSession, acquireEppLease, eppLoginResumeOptions };
