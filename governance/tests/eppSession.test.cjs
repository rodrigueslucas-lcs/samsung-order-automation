const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { getEppConfig } = require("../../config/markets/epp");
const { getEppSessionPaths, getPrimaryEppCredentials, loadEppSession, installEppSessionStorage, eppLoginResumeOptions } = require("../../utils/eppSession.cjs");
const { isEppPage, assertEppAuthContinuation } = require("../../scripts/auth-refresh-epp.cjs");
const {captureEppPageState}=require('../../utils/eppSession.cjs');

test('EPP capture reads the current staging programme in place without visiting stored origins',async()=>{
  const config=getEppConfig('MX',{});
  const snapshot=await captureEppPageState({cookies:async()=>[],storageState:()=>{throw Error('must not navigate');}},{url:()=>config.rootUrl.href,evaluate:async()=>({localStorage:[{name:'synthetic',value:'fixture'}],sessionStorage:{synthetic:'fixture'}})},config);
  assert.equal(snapshot.storageState.origins.length,1);
  assert.equal(snapshot.storageState.origins[0].origin,config.rootUrl.origin);
  assert.equal(snapshot.sessionStorage.synthetic,'fixture');
});
test('EPP capture rejects a foreign programme before reading storage',async()=>{
  const config=getEppConfig('MX',{});
  await assert.rejects(captureEppPageState({}, {url:()=>config.rootUrl.origin+'/mx/'},config),/exact staging programme/);
});
test('EPP capture times out without accepting suspended storage as a valid snapshot',async()=>{
  const config=getEppConfig('MX',{});
  await assert.rejects(captureEppPageState({cookies:()=>new Promise(()=>{})},{url:()=>config.rootUrl.href,evaluate:async()=>({})},config,{timeoutMs:10}),error=>error.code==='EPP_SNAPSHOT_TIMEOUT');
});

test('EPP security denial and blocked redirects stop continuation without exposing the provider URL',()=>{
  assert.throws(()=>assertEppAuthContinuation({url:()=> 'https://account.samsung.com/iam/blocked?secret=fixture'}),e=>e.exitCode===78&&e.eppReason==='SAMSUNG_ACCOUNT_SECURITY_BLOCKED'&&!e.message.includes('fixture'));
  assert.throws(()=>assertEppAuthContinuation({url:()=> 'about:blank'},{lastBlocked:()=>({reason:'PRODUCTION_NAVIGATION_BLOCKED'})}),e=>e.eppReason==='PRODUCTION_NAVIGATION_BLOCKED');
  assert.doesNotThrow(()=>assertEppAuthContinuation({url:()=> 'https://account.samsung.com/iam/login'}));
});
test('fresh EPP login never inherits an old email checkpoint', () => {
  assert.deepEqual(eppLoginResumeOptions({ emailPhase:'CHALLENGE', passwordAttempted:true },true), { resumeOnly:false, resumeEmailPhase:'NONE' });
  assert.deepEqual(eppLoginResumeOptions({ emailPhase:'NONE' }), { resumeOnly:false, resumeEmailPhase:'NONE' });
  assert.deepEqual(eppLoginResumeOptions({ emailPhase:'CHALLENGE' }), { resumeOnly:true, resumeEmailPhase:'CHALLENGE' });
  assert.throws(() => eppLoginResumeOptions({ emailPhase:'UNKNOWN' }), /Unknown/);
});

for (const market of ["MX", "PE", "CO", "CL"]) for (const environment of ["S1", "S2"]) {
  test(`${market} ${environment} isolates EPP files and profiles from Base Store`, () => {
    const config = getEppConfig(market, { ENVIRONMENT: environment });
    const files = getEppSessionPaths(config);
    assert.match(files.directory.replace(/\\/g, "/"), new RegExp(`/playwright/\\.auth/epp/${environment.toLowerCase()}/${market.toLowerCase()}${config.programNamespace?'/programs/'+config.program:''}$`));
    assert.match(files.profile.replace(/\\/g, "/"), /\/playwright\/profiles\/epp\//);
    assert.notEqual(files.profile, path.resolve(`playwright/profiles/${environment.toLowerCase()}-${market.toLowerCase()}-qa`));
  });
}

test("EPP FIRST credential lookup never inherits SECOND aliases or state", () => {
  const read = [];
  const io = { existsSync: () => true, readFileSync: file => { read.push(file); return JSON.stringify({ email: "synthetic@example.invalid", password: "fixture-only" }); } };
  const config = getEppConfig("CO", {});
  const value = getPrimaryEppCredentials(config, { MX_AUTH_SLOT: "second", CO_AUTH_SLOT: "second", CO_SECOND_SAMSUNG_EMAIL: "second@example.invalid" }, io);
  assert.equal(value.email, "synthetic@example.invalid");
  assert.ok(read.every(file => !file.includes("second") && path.basename(file) === "samsung-storefront-user.json"));
});

test("missing EPP state creates an empty context instead of a Base Store fallback", () => {
  assert.deepEqual(loadEppSession(getEppConfig("PE", {}), { existsSync: () => false }), { storageState: { cookies: [], origins: [] }, sessionStorage: {} });
});
test("CL uses the configured shared FIRST even without a CL-specific credential file", () => {
  const io = { existsSync: file => path.basename(file) === "mx-storefront-user.json", readFileSync: () => JSON.stringify({ email: "first@example.invalid", password: "fixture-only" }) };
  assert.equal(getPrimaryEppCredentials(getEppConfig("CL", {}), {}, io).email, "first@example.invalid");
});

for (const mismatch of [{ store: "BASE_STORE" }, { market: "MX" }, { environment: "S1" }, { root: "https://stg2.shop.samsung.com/pe/" }, { verified: false }]) {
  test(`EPP state rejects mismatched ${Object.keys(mismatch)[0]}`, () => {
    const config = getEppConfig("PE", {});
    const marker = { store: "EPP", market: "PE", environment: "S2", root: config.rootUrl.href, verified: true, ...mismatch };
    assert.throws(() => loadEppSession(config, { existsSync: () => true, readFileSync: () => JSON.stringify(marker) }), /another multistore/);
  });
}

test("EPP sessionStorage initialization is scoped to the precise origin and store root", async () => {
  let argumentsSeen;
  const context = { addInitScript: async (_, args) => { argumentsSeen = args; } };
  const config = getEppConfig("CL", {});
  await installEppSessionStorage(context, config, { synthetic: "fixture-only" });
  assert.equal(argumentsSeen.origin, config.rootUrl.origin);
  assert.equal(argumentsSeen.prefix, config.rootUrl.pathname);
  assert.notEqual(argumentsSeen.prefix, "/cl/");
});
test("resuming an owned EPP confirmation never requires navigating through Base Store", () => {
  const config = getEppConfig("MX", { ENVIRONMENT: "S1" });
  const page = (url, closed = false) => ({ url: () => url, isClosed: () => closed });
  assert.equal(isEppPage(page(config.rootUrl.href + "registration"), config), true);
  assert.equal(isEppPage(page(config.rootUrl.href), config), true);
  assert.equal(isEppPage(page("https://stg.shop.samsung.com/mx/"), config), false);
  assert.equal(isEppPage(page("https://account.samsung.com/"), config), false);
  assert.equal(isEppPage(page(config.rootUrl.href, true), config), false);
});
