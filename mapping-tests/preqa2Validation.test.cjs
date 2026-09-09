const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createMarketMatrix,
  createValidationEntry,
  sanitizeRuntimePath,
  summarizeMatrix,
} = require("../utils/preqa2Validation");

test("PreQA2 matrices contain every official SMB QST ID per market", () => {
  assert.equal(createMarketMatrix("MX").length, 37);
  assert.equal(createMarketMatrix("CL").length, 38);
  assert.equal(createMarketMatrix("CO").length, 35);
  assert.equal(createMarketMatrix("PE").length, 34);
});

test("PreQA2 evidence never retains query strings or fragments", () => {
  assert.equal(
    sanitizeRuntimePath("https://p6-pre-qa2.samsung.com/mx/cart?token=secret#checkout"),
    "/mx/cart"
  );
});

test("PreQA2 PASS is a first-class official validation result", () => {
  const entry = createValidationEntry({
    market: "MX",
    id: "SAM-24968",
    status: "PASS",
    runtimeUrl: "https://p6-pre-qa2.samsung.com/mx/smartphones/all-smartphones/",
    evidence: "Official Expected Result proven in PreQA2.",
  });
  assert.equal(entry.environment, "PREQA2");
  assert.equal(entry.status, "PASS");
  assert.equal(entry.runtimePath, "/mx/smartphones/all-smartphones/");
});

test("matrix rejects non-official IDs and unsupported result labels", () => {
  assert.throws(() => createValidationEntry({ market: "MX", id: "SAM-00000" }), /not an official/);
  assert.throws(
    () => createValidationEntry({ market: "MX", id: "SAM-24968", status: "PREQA2_PASS" }),
    /Unsupported PreQA2 validation status/
  );
});

test("matrix summary keeps PASS FAIL BLOCKED and NOT_RUN separate", () => {
  const matrix = createMarketMatrix("MX", {
    "SAM-24968": { status: "PASS" },
    "SAM-24964": { status: "FAIL" },
    "SAM-24975": { status: "BLOCKED" },
  });
  assert.deepEqual(summarizeMatrix(matrix), {
    NOT_RUN: 34,
    PASS: 1,
    FAIL: 1,
    BLOCKED: 1,
    NOT_APPLICABLE: 0,
  });
});
