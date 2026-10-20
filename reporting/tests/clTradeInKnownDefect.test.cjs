const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const registry = require("../../governance/known-defects.json");
const clSpec = fs.readFileSync(
  path.join(root, "tests/markets/cl/qst/base-store/official-p1.spec.js"),
  "utf8"
);

function findDefect(environment) {
  return registry.defects.find((defect) =>
    defect.market === "CL" &&
    defect.environment === environment &&
    defect.store === "BASE_STORE" &&
    defect.samId === "SAM-24803"
  );
}

test("CL S2 SAM-24803 is mapped to SAM-25150", () => {
  const defect = findDefect("S2");
  assert.ok(defect, "CL S2 SAM-24803 known-defect mapping is required");
  assert.equal(defect.jira, "SAM-25150");
  assert.equal(defect.classification, "KNOWN_DEFECT");
  assert.match(defect.url, /SAM-25150$/);
});

test("CL SAM-24803 remains an explicit blocked/non-gating official scenario", () => {
  assert.match(
    clSpec,
    /SAM-24803 @blocked @qst @cl @base-store - Verify Recycle & Save Trade-in on cart page/
  );
  assert.match(clSpec, /SAM-24803[\s\S]{0,300}blocked\(/);
});
