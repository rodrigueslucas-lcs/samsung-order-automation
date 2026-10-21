const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const registry = require("../../governance/known-defects.json");
const paymentFlow = fs.readFileSync(path.join(root, "flows/cl/paymentFlows.js"), "utf8");
const clSpec = fs.readFileSync(path.join(root, "tests/markets/cl/qst/base-store/official-p1.spec.js"), "utf8");

const blockedIds = ["SAM-24823", "SAM-24824"];

function findDefect(samId) {
  return registry.defects.find((defect) =>
    defect.market === "CL" &&
    defect.environment === "S2" &&
    defect.store === "BASE_STORE" &&
    defect.samId === samId
  );
}

test("CL S2 order-dependent official TCs are mapped to RT-751761", () => {
  for (const samId of blockedIds) {
    const defect = findDefect(samId);
    assert.ok(defect, `CL S2 ${samId} known-defect mapping is required`);
    assert.equal(defect.jira, "RT-751761");
    assert.equal(defect.classification, "KNOWN_DEFECT");
    assert.match(defect.url, /RT-751761$/);
  }
});

test("CL S2 order-dependent TCs hard-skip before payment execution while RT-751761 is active", () => {
  for (const samId of blockedIds) {
    assert.ok(paymentFlow.includes(`"${samId}"`), `${samId} must be included in the CL S2 RT-751761 blocker set`);
    assert.match(clSpec, new RegExp(`${samId}[\\s\\S]{0,220}`), `${samId} must remain in the official CL Base Store spec`);
  }
  assert.match(paymentFlow, /CL_S2_RT_751761_BLOCKED_IDS/);
  assert.match(paymentFlow, /environment !== "S2"/);
  assert.match(paymentFlow, /KNOWN DEFECT RT-751761/);
  assert.match(paymentFlow, /blockClS2OrderClosureKnownDefect\(testInfo, environment\);/);
  assert.match(
    paymentFlow,
    /blockClS2OrderClosureKnownDefect\(testInfo, environment\);[\s\S]{0,200}ALLOW_PAYMENT_SUBMIT/,
    "known-defect skip must happen before destructive payment authorization/execution"
  );
});

test("SAM-24825 keeps its independent Rewards prerequisite blocker", () => {
  assert.match(clSpec, /\["SAM-24825", "Payment using Rewards", "Missing Rewards test data:/);
  assert.match(clSpec, /test\(`\$\{id\} @blocked @qst @cl @base-store - \$\{title\}`,[\s\S]{0,80}blocked\(reason\)/);
  assert.doesNotMatch(paymentFlow, /CL_S2_RT_751761_BLOCKED_IDS[\s\S]{0,200}"SAM-24825"/);
});

test("normal CL card and confirmation execute while installments and transfer stay blocked", () => {
  const blockerSet = paymentFlow.match(/CL_S2_RT_751761_BLOCKED_IDS = new Set\(\[([\s\S]*?)\]\)/)[1];
  for (const id of ["SAM-24822", "SAM-24826"]) {
    assert.doesNotMatch(blockerSet, new RegExp(id));
    assert.equal(findDefect(id), undefined, 'new failures in reactivated scenarios must not be masked by the old blanket defect');
  }
  assert.match(clSpec, /SAM-24826[\s\S]{0,400}kind: "card"/);
  assert.match(paymentFlow, /singleItem: true, paymentProduct: true/);
});
