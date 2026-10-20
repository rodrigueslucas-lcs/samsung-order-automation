const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const registry = require("../../governance/known-defects.json");
const paymentFlow = fs.readFileSync(path.join(root, "flows/cl/paymentFlows.js"), "utf8");
const clSpec = fs.readFileSync(path.join(root, "tests/markets/cl/qst/base-store/official-p1.spec.js"), "utf8");

function findDefect() {
  return registry.defects.find((defect) =>
    defect.market === "CL" &&
    defect.environment === "S2" &&
    defect.store === "BASE_STORE" &&
    defect.samId === "SAM-24822"
  );
}

test("CL S2 SAM-24822 is mapped to RT-751761", () => {
  const defect = findDefect();
  assert.ok(defect, "CL S2 SAM-24822 known-defect mapping is required");
  assert.equal(defect.jira, "RT-751761");
  assert.equal(defect.classification, "KNOWN_DEFECT");
  assert.match(defect.url, /RT-751761$/);
});

test("SAM-24822 only skips for the exact mapped S2 card-payment symptom", () => {
  assert.match(clSpec, /SAM-24822[\s\S]{0,160}Payment using Credit \/ Debit card with reg user/);
  assert.match(paymentFlow, /kind !== "card" \|\| environment !== "S2"/);
  assert.match(paymentFlow, /Hubo un inconveniente con el medio de pago/i);
  assert.match(paymentFlow, /KNOWN DEFECT RT-751761/);
  assert.match(paymentFlow, /await skipMappedClCardPaymentDefect\(page, testInfo, error, \{ kind, environment \}\);/);
  assert.match(paymentFlow, /throw error;/, "unrelated payment errors must remain failures");
});
