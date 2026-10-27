const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { getEppConfig } = require("../../config/markets/epp");
const { isRegisteredUser, watchEppServerProof } = require("../../utils/eppServerProof.cjs");

function response({ site = "pymesmx", kind = "user", status = 200, payload = { uid: "fixture@example.invalid" }, host = "s2-smb-api-cdn.ecom-stg.samsung.com" } = {}) {
  return { url: () => `https://${host}/tokocommercewebservices/v2/${site}/users/current${kind === "access" ? "/checkAccess" : ""}`, request: () => ({ method: () => "GET" }), status: () => status, json: async () => payload };
}
test("registered identity requires a non-anonymous user and matches FIRST when supplied", () => {
  assert.equal(isRegisteredUser({ uid: "anonymous" }), false);
  assert.equal(isRegisteredUser({ uid: "fixture@example.invalid" }, "other@example.invalid"), false);
  assert.equal(isRegisteredUser({ uid: "fixture@example.invalid" }, "FIXTURE@example.invalid"), true);
});
test("both server user and EPP access acceptance are necessary; no Bearer assumption", async () => {
  const context = new EventEmitter(), proof = watchEppServerProof(context, getEppConfig("MX", {}));
  context.emit("response", response()); await proof.settle(); assert.equal(proof.accepted(), false);
  context.emit("response", response({ kind: "access", payload: { canAccess: true } })); await proof.settle();
  assert.equal(proof.accepted(), true); proof.stop();
});
test("Base Store or another EPP site cannot prove this identity", async () => {
  const context = new EventEmitter(), proof = watchEppServerProof(context, getEppConfig("MX", {}));
  for (const site of ["mx", "mxtotalplay", "co_epp_agre"]) context.emit("response", response({ site }));
  await proof.settle(); assert.equal(proof.accepted(), false); assert.equal(proof.snapshot().userAccepted, false); proof.stop();
});
test('another environment API cannot prove EPP S2 authentication', async () => {
  const context = new EventEmitter(), proof = watchEppServerProof(context,getEppConfig('MX',{}));
  context.emit('response',response({host:'s1-smb-api-cdn.ecom-stg.samsung.com'}));
  await proof.settle();
  assert.equal(proof.snapshot().userAccepted,false);
  proof.stop();
});
for (const [status, reason] of [[401, "SERVER_AUTH_REJECTED"], [503, "SERVER_UNAVAILABLE"]]) {
  test(`HTTP ${status} has a distinct causal classification`, async () => {
    const context = new EventEmitter(), proof = watchEppServerProof(context, getEppConfig("MX", {}));
    context.emit("response", response({ status })); await proof.settle();
    assert.equal(proof.snapshot().reason, reason); assert.equal(proof.accepted(), false); proof.stop();
  });
}
test("late server rejection invalidates an earlier acceptance and remains secret-free", async () => {
  const context = new EventEmitter(), proof = watchEppServerProof(context, getEppConfig("MX", {}));
  context.emit("response", response()); context.emit("response", response({ kind: "access", payload: { canAccess: true } })); await proof.settle();
  context.emit("response", response({ status: 401 })); await proof.settle();
  assert.equal(proof.accepted(), false); assert.doesNotMatch(JSON.stringify(proof.snapshot()), /fixture@example|uid|cookie|token/i); proof.stop();
});
