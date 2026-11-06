const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyEppAccess, observeEppAccess } = require("../../utils/eppAccessState.cjs");
const {configuredEppAuthEntry}=require('../../utils/eppAccessState.cjs');
const {withEppIdentityProof}=require('../../utils/eppAccessState.cjs');
test('missing CMS/header is separate from positively proven identity and entitlement',()=>{
 const root='https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/';
 const state={status:'BLOCKED',reason:'COMMERCE_CONTENT_NOT_RENDERED'};
 const valid={userAccepted:true,accessAccepted:true};
 assert.equal(withEppIdentityProof(state,{url:root,rootUrl:root,proof:valid}).reason,'SERVER_AUTHENTICATED_EPP_HOME');
 for(const proof of [{userAccepted:false,accessAccepted:true},{userAccepted:true,accessAccepted:false},{}])assert.equal(withEppIdentityProof(state,{url:root,rootUrl:root,proof}),state);
 for(const url of [root+'registration',root+'p/QA','https://www.samsung.com/cl/'])assert.equal(withEppIdentityProof(state,{url,rootUrl:root,proof:valid}),state);
 for(const reason of ['ACCESS_GATE_VISIBLE','CORPORATE_ACTIVATION_REQUIRED','VERIFICATION_CODE_REJECTED']){
  const gate={status:'BLOCKED',reason};assert.equal(withEppIdentityProof(gate,{url:root,rootUrl:root,proof:valid}),gate);
 }
});
test('configured EPP auth entry only resumes an empty programme homepage',()=>{
 const rootUrl=new URL('https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/');
 const cfg={rootUrl,authEntryUrl:new URL('auth/multistore',rootUrl)};
 assert.equal(configuredEppAuthEntry(cfg,{url:rootUrl.href}).href,cfg.authEntryUrl.href);
 for(const flag of ['loginVisible','profileVisible','emailVisible','codeVisible','pendingVerification'])assert.equal(configuredEppAuthEntry(cfg,{url:rootUrl.href,[flag]:true}),null);
 for(const url of ['https://account.samsung.com/',new URL('registration',rootUrl).href,new URL('auth/multistore',rootUrl).href])assert.equal(configuredEppAuthEntry(cfg,{url}),null);
 assert.throws(()=>configuredEppAuthEntry({...cfg,authEntryUrl:new URL('https://www.samsung.com/shop/')},{url:rootUrl.href}),/configured staging programme/);
});
const rootUrl = "https://stg2.shop.samsung.com/pe/multistore/beneficios_empleados/beneficios_empleados/";
const state = overrides => classifyEppAccess({ url: rootUrl, rootUrl, ...overrides });

test("a shell or Samsung footer is not successful access", () => {
  assert.equal(state({ body: "Skip to Header Samsung Copyright" }).status, "BLOCKED");
});
test("commerce outside the precise store cannot prove EPP access", () => {
  assert.equal(state({ url: "https://stg2.shop.samsung.com/pe/", commerceVisible: true }).reason, "OUTSIDE_EPP_STORE");
});
test("Samsung Account gate requires independent EPP identity", () => {
  assert.equal(state({ url: rootUrl + "auth/multistore", body: "Inicie sesión con su cuenta Samsung", commerceVisible: true }).status, "HUMAN_REQUIRED");
});
test("corporate activation is a human prerequisite", () => {
  assert.equal(state({ url: rootUrl + "registration", corporateEmailVisible: true }).reason, "CORPORATE_ACTIVATION_REQUIRED");
});
test("verification code gate is distinct from Samsung password", () => {
  assert.equal(state({ url: rootUrl + "auth/multistore", codeVisible: true }).status, "CODE_REQUIRED");
});
test("unknown gate remains blocked even with commerce underneath", () => {
  assert.equal(state({ url: rootUrl + "auth/multistore", commerceVisible: true }).status, "BLOCKED");
});
test("rendered commerce inside the unlocked store proves access", () => {
  assert.equal(state({ commerceVisible: true }).status, "READY");
});
test("visible access gates take precedence over commerce", () => {
  assert.equal(state({ commerceVisible: true, codeVisible: true }).status, "BLOCKED");
});
test("authenticated landing proof is separate from product catalog availability", () => {
  assert.equal(state({ authenticatedHomepageVisible: true }).reason, "AUTHENTICATED_EPP_HOMEPAGE");
  assert.equal(state({ url: rootUrl + "registration", authenticatedHomepageVisible: true }).status, "BLOCKED");
  assert.equal(state({ url: rootUrl + "cart", authenticatedHomepageVisible: true }).status, "BLOCKED");
});
test("a document transition is pending observation, not expired auth or another submit", async () => {
  const page = { evaluate: async () => { throw new Error("Execution context was destroyed, most likely because of a navigation"); }, isClosed: () => false };
  assert.deepEqual(await observeEppAccess(page, { rootUrl: new URL(rootUrl) }), { status: "BLOCKED", reason: "NAVIGATION_IN_PROGRESS" });
});
test("an unrelated failure or closed browser is never hidden as a transient navigation", async () => {
  for (const [message, closed] of [["Unexpected script failure", false], ["Execution context was destroyed", true]]) {
    const page = { evaluate: async () => { throw new Error(message); }, isClosed: () => closed };
    await assert.rejects(observeEppAccess(page, { rootUrl: new URL(rootUrl) }), new RegExp(message));
  }
});
