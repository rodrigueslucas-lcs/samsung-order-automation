const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const registry = require("../../governance/known-defects.json");
const spec = fs.readFileSync(
  path.join(root, "tests/markets/cl/qst/base-store/official-p1.spec.js"),
  "utf8"
);

test("CL S2 SAM-24821 is mapped to RT-746043", () => {
  const defect = registry.defects.find((item) =>
    item.market === "CL" &&
    item.environment === "S2" &&
    item.store === "BASE_STORE" &&
    item.samId === "SAM-24821"
  );
  assert.ok(defect);
  assert.equal(defect.jira, "RT-746043");
  assert.equal(defect.classification, "KNOWN_DEFECT");
});

test("CL S2 Back to Top skips only when the known missing-control symptom reproduces", () => {
  const start = spec.indexOf('test("SAM-24821');
  const end = spec.indexOf('test("SAM-24830', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = spec.slice(start, end);

  assert.match(block, /cfg\.environment === "S2"/);
  assert.match(block, /test\.skip\(true, "KNOWN DEFECT RT-746043:/);
  assert.match(block, /await control\.click\(\)/);
  assert.match(block, /toBeLessThan\(200\)/);
});
